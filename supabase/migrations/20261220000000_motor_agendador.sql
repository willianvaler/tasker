-- Motor de automações: agendador, prazos, esperar, novas tentativas, perdidos e as regras antigas
-- (ESCOPO_V14 §6.2, AU5, D337).
--
-- - `horario` e `intervalo`: cada regra tem `next_run_at`, calculado ao salvar no fuso da dona; o
--   varredor (pg_cron, todo minuto) gera o evento e calcula o próximo.
-- - `tarefa.atrasada` e `tarefa.vencendo`: varredura por marca d'água (`automation_scan_state`), só
--   a janela (última varredura, agora], pelo índice de vencimento; uma vez por tarefa e vencimento.
-- - Evento que chega tarde demais (o `previsto` ou a criação passou do limite da regra, padrão 15
--   min) vira execução `perdido`, sem rodar.
-- - `esperar`: a execução fica `esperando` com `resume_at` no banco e volta sozinha; a definição vai
--   junto com a execução (`automation_runs.definition`).
-- - Nova tentativa (erro passageiro de um passo externo, AU8/SL3): depois de 1, 5 e 30 min; na
--   quarta, falha.
-- - Anti-laço mínimo: evento gerado por uma ação de automação leva a profundidade; da terceira em
--   diante não é gravado (os limites de taxa e o resto do anti-laço são do AU6).
-- - As regras antigas da D143 passam para o motor novo: o caminho síncrono (`task_events_automations`,
--   `_run_automations`, `_automation_act`) e o cron de prazo saem; a tela antiga continua gravando
--   as colunas antigas (a definição é derivada delas) e lendo o `automation_log`, que o motor
--   passa a escrever para essas regras.

alter table public.automation_runs add column definition jsonb, add column retries integer not null default 0;

-- ---------------------------------------------------------------------------------------------
-- As regras antigas entram no motor
-- ---------------------------------------------------------------------------------------------
drop trigger task_events_automations on public.task_events;
select cron.unschedule('questlist-automacoes-prazo') where exists (select 1 from cron.job where jobname = 'questlist-automacoes-prazo');
drop function public.task_events_automations();
drop function public.run_overdue_automations();
drop function public._run_automations(text, uuid);
drop function public._automation_act(public.automation_rules, public.tasks);

-- Regras que casam com o evento. Com `regra` no payload (executar agora, chamada por outra regra,
-- agendador, prazo), só ela. Gatilho com `lista` (a "em qual lista" da D143) filtra pela lista.
create or replace function public._automation_matching(p_kind text, p_owner uuid, p_folder uuid, p_payload jsonb)
returns setof public.automation_rules
language sql stable security definer set search_path = ''
as $$
  select r.* from public.automation_rules r
  where r.enabled
    and case when p_payload ? 'regra' then r.id = (p_payload ->> 'regra')::uuid
             else r.trigger_type = p_kind
                  and ((r.scope = 'pessoal' and r.owner_id = p_owner)
                       or (r.scope = 'projeto' and r.folder_id = p_folder))
                  and (r.definition #>> '{gatilho,lista}' is null
                       or r.definition #>> '{gatilho,lista}' = p_payload ->> 'lista') end;
$$;

create or replace function public._automation_wants(p_kind text, p_owner uuid, p_folder uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(current_setting('questlist.bulk', true), '') <> '1'
     and coalesce(nullif(current_setting('questlist.automation_depth', true), '')::integer, 0) < 3
     and (exists (select 1 from public.automation_rules
                  where enabled and owner_id = p_owner and scope = 'pessoal' and trigger_type = p_kind)
          or exists (select 1 from public.automation_rules
                     where enabled and folder_id = p_folder and trigger_type = p_kind));
$$;

-- O evento leva a profundidade de quem o gerou (0 = ação de uma pessoa)
create or replace function public.automation_emit(
  p_kind text, p_payload jsonb default '{}', p_owner uuid default null, p_folder uuid default null,
  p_dedupe text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_depth integer := coalesce(nullif(current_setting('questlist.automation_depth', true), '')::integer, 0);
begin
  if not public._automation_wants(p_kind, p_owner, p_folder) then
    return null;
  end if;
  insert into public.automation_events (owner_id, folder_id, kind, payload, dedupe_key)
  values (p_owner, p_folder, p_kind,
          coalesce(p_payload, '{}') || case when v_depth > 0 then jsonb_build_object('_profundidade', v_depth) else '{}' end,
          p_dedupe)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.automation_run_now(p_rule uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules;
  v_id uuid;
begin
  select * into v_rule from public.automation_rules where id = p_rule;
  if v_rule.id is null
     or not ((v_rule.scope = 'pessoal' and v_rule.owner_id = auth.uid())
             or (v_rule.scope = 'projeto' and public.has_permission(v_rule.folder_id, 'automation.manage'))) then
    raise exception 'Automação não encontrada' using errcode = '42501';
  end if;
  if not v_rule.enabled then
    raise exception 'A automação está desligada' using errcode = '22023';
  end if;
  insert into public.automation_events (owner_id, folder_id, kind, payload)
  values (v_rule.owner_id, v_rule.folder_id, 'manual', jsonb_build_object('regra', v_rule.id, 'por', auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Agendador: próximo disparo no fuso da dona
-- ---------------------------------------------------------------------------------------------
create function public._automation_next_run(p_definition jsonb, p_tz text, p_after timestamptz)
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  v_tz text := coalesce(nullif(p_tz, ''), 'America/Sao_Paulo');
  v_local timestamp;
  v_day date;
  v_at timestamptz;
  v_dias jsonb := coalesce(p_definition #> '{gatilho,dias}', '[]');
begin
  case p_definition #>> '{gatilho,tipo}'
    when 'horario' then
      v_local := p_after at time zone v_tz;
      for i in 0..7 loop
        v_day := v_local::date + i;
        continue when jsonb_array_length(v_dias) > 0 and not v_dias ? extract(dow from v_day)::integer::text
                      and not v_dias @> to_jsonb(extract(dow from v_day)::integer);
        v_at := (v_day + (p_definition #>> '{gatilho,hora}')::time) at time zone v_tz;
        if v_at > p_after then
          return v_at;
        end if;
      end loop;
      return null;
    when 'intervalo' then
      return p_after + make_interval(hours => (p_definition #>> '{gatilho,horas}')::integer);
    else
      return null;
  end case;
end;
$$;

-- Ao salvar (o validador chama): liga, desliga ou recalcula o próximo disparo
create or replace function public.automation_rules_schedule()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.enabled and new.trigger_type in ('horario', 'intervalo') then
    if tg_op = 'INSERT' or new.definition is distinct from old.definition or not old.enabled or new.next_run_at is null then
      new.next_run_at := public._automation_next_run(new.definition,
        (select timezone from public.profiles where id = new.owner_id), now());
    end if;
  else
    new.next_run_at := null;
  end if;
  return new;
end;
$$;
-- Depois do automation_rules_check (que define trigger_type): os gatilhos BEFORE rodam em ordem alfabética
create trigger automation_rules_zschedule
  before insert or update of scope, owner_id, folder_id, page_id, trigger, action, params, name, definition, enabled
  on public.automation_rules
  for each row execute function public.automation_rules_schedule();

-- Mudou o fuso da pessoa: os horários dela andam junto
create function public.profiles_timezone_automations()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.automation_rules
  set next_run_at = public._automation_next_run(definition, new.timezone, now())
  where owner_id = new.id and enabled and trigger_type = 'horario';
  return null;
end;
$$;
create trigger profiles_timezone_automations after update of timezone on public.profiles
  for each row when (new.timezone is distinct from old.timezone)
  execute function public.profiles_timezone_automations();

-- Regras na hora: um evento cada (o atrasado demais vira `perdido` na reivindicação) e o próximo
create function public._automation_schedule()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules;
  v_tz text;
  v_next timestamptz;
  v_count integer := 0;
begin
  for v_rule in
    select * from public.automation_rules
    where enabled and next_run_at <= now() and trigger_type in ('horario', 'intervalo')
    order by next_run_at
    for update skip locked
    limit 200
  loop
    insert into public.automation_events (owner_id, kind, payload, dedupe_key)
    values (v_rule.owner_id, v_rule.trigger_type,
            jsonb_build_object('regra', v_rule.id, 'previsto', v_rule.next_run_at, 'agora', v_rule.next_run_at),
            'ag|' || v_rule.id || '|' || v_rule.next_run_at)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    v_tz := (select timezone from public.profiles where id = v_rule.owner_id);
    if v_rule.trigger_type = 'intervalo' then
      -- O próximo da série, pulando o que ficou para trás
      v_next := v_rule.next_run_at;
      loop
        v_next := public._automation_next_run(v_rule.definition, v_tz, v_next);
        exit when v_next > now();
      end loop;
    else
      v_next := public._automation_next_run(v_rule.definition, v_tz, now());
    end if;
    update public.automation_rules set next_run_at = v_next where id = v_rule.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Prazos: varredura por marca d'água
-- ---------------------------------------------------------------------------------------------
create table public.automation_scan_state (
  kind text primary key,
  last_scan_at timestamptz not null
);
alter table public.automation_scan_state enable row level security;
revoke all on public.automation_scan_state from anon, authenticated;

-- O instante do vencimento: com hora, a hora no fuso; só data, o fim do dia (atrasa à meia-noite)
create function public._automation_due_at(p_date date, p_time time, p_tz text)
returns timestamptz
language sql immutable set search_path = ''
as $$
  select case when p_time is null then (p_date + 1)::timestamp at time zone p_tz
              else (p_date + p_time) at time zone p_tz end;
$$;

create function public._automation_scan_due()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_last timestamptz;
  v_now timestamptz := now();
  v_rule public.automation_rules;
  v_tz text;
  v_ante integer;
  v_task record;
  v_count integer := 0;
begin
  select last_scan_at into v_last from public.automation_scan_state where kind = 'prazos' for update;
  if v_last is null then
    insert into public.automation_scan_state values ('prazos', v_now) on conflict (kind) do nothing;
    return 0;
  end if;
  -- Servidor fora por mais de 1 dia: só o último dia (o resto já seria `perdido`)
  v_last := greatest(v_last, v_now - interval '1 day');

  for v_rule in
    select * from public.automation_rules
    where enabled and trigger_type in ('tarefa.atrasada', 'tarefa.vencendo')
  loop
    v_tz := coalesce((select timezone from public.profiles where id = v_rule.owner_id), 'America/Sao_Paulo');
    v_ante := case when v_rule.trigger_type = 'tarefa.vencendo'
                   then coalesce((v_rule.definition #>> '{gatilho,minutos}')::integer, 60) else 0 end;
    for v_task in
      select t.id, t.due_date, t.due_time,
             public._automation_due_at(t.due_date, t.due_time, v_tz) as due_at
      from public.tasks t
      where t.status <> 'done' and t.due_date is not null
        -- O índice de vencimento (tasks_due_date_idx) limita a uns poucos dias
        and t.due_date between (v_last at time zone v_tz)::date - 2 and (v_now at time zone v_tz)::date + 3
        and public._automation_due_at(t.due_date, t.due_time, v_tz) - make_interval(mins => v_ante) > v_last
        and public._automation_due_at(t.due_date, t.due_time, v_tz) - make_interval(mins => v_ante) <= v_now
        and (v_rule.definition #>> '{gatilho,lista}' is null or t.page_id::text = v_rule.definition #>> '{gatilho,lista}')
        and case when v_rule.scope = 'projeto' then public.folder_root(t.folder_id) = v_rule.folder_id
                 -- Pessoal: as tarefas dela (atribuídas a ela, ou criadas por ela e sem ninguém)
                 else exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = v_rule.owner_id)
                      or (t.created_by = v_rule.owner_id
                          and not exists (select 1 from public.task_assignees a where a.task_id = t.id)) end
    loop
      insert into public.automation_events (owner_id, folder_id, kind, payload, dedupe_key)
      values (v_rule.owner_id, v_rule.folder_id, v_rule.trigger_type,
              public._automation_task_payload(v_task.id, null) || jsonb_build_object(
                'regra', v_rule.id, 'previsto', v_task.due_at - make_interval(mins => v_ante),
                'atraso_min', case when v_ante = 0 then greatest(floor(extract(epoch from v_now - v_task.due_at) / 60), 0) end,
                'faltam_min', case when v_ante > 0 then v_ante end),
              'pz|' || v_rule.id || '|' || v_task.id || '|' || v_task.due_date || '|' || coalesce(v_task.due_time::text, ''))
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;
  update public.automation_scan_state set last_scan_at = v_now where kind = 'prazos';
  return v_count;
end;
$$;

-- O varredor de todo minuto: agenda, prazos e, havendo trabalho, o executor
create or replace function public._automation_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_schedule();
  perform public._automation_scan_due();
  if exists (select 1 from public.automation_events where processed_at is null and available_at <= now())
     or exists (select 1 from public.automation_runs
                where status = 'pendente'
                   or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
                   or (status = 'esperando' and resume_at <= now())) then
    perform public._automation_kick();
  end if;
end;
$$;

-- Regras ativas de horário e intervalo que já existem ganham o próximo disparo
update public.automation_rules r
set next_run_at = public._automation_next_run(r.definition, p.timezone, now())
from public.profiles p
where p.id = r.owner_id and r.enabled and r.trigger_type in ('horario', 'intervalo');

-- ---------------------------------------------------------------------------------------------
-- Efeitos (o aviso das regras antigas no formato de antes)
-- ---------------------------------------------------------------------------------------------
create or replace function public._automation_effect(p_run public.automation_runs, p_rule public.automation_rules, p_effect jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task uuid;
  v_title text;
  v_target uuid;
  v_payload jsonb;
  v_page public.pages;
  v_row public.tasks;
  v_id uuid;
  v_labels text[];
  v_add text[];
  v_del text[];
  v_target_rule public.automation_rules;
  v_chain jsonb;
  v_actor uuid;
  v_claims text;
begin
  if p_rule.scope = 'projeto' and not public.is_folder_member(p_rule.folder_id) then
    raise exception 'Quem criou a automação não está mais no projeto';
  end if;

  case p_effect ->> 'tipo'
    when 'notificacao' then
      v_task := public._automation_task_of(p_run, '{}');
      v_title := (select title from public.tasks where id = v_task);
      -- Regra antiga (D143): o aviso sai no formato de antes (mensagem: "tarefa"), sem o rule_id
      v_payload := jsonb_strip_nulls(jsonb_build_object(
        'rule_id', case when p_rule.trigger is null then p_rule.id end, 'automation_rule', p_rule.id,
        'rule_name', p_rule.name,
        'titulo', nullif(p_effect ->> 'titulo', ''), 'message', nullif(p_effect ->> 'corpo', ''),
        'task_id', v_task, 'title', v_title,
        'push', case when p_effect ->> 'canal' = 'app' then false end));
      for v_target in
        select p_rule.owner_id where p_rule.scope = 'pessoal' or coalesce(p_effect ->> 'para', 'dona') = 'dona'
        union
        select a.user_id from public.task_assignees a
        where p_rule.scope = 'projeto' and p_effect ->> 'para' = 'responsaveis' and a.task_id = v_task
          and a.user_id is not null
        union
        select m.user_id from public.folder_members m
        where p_rule.scope = 'projeto' and p_effect ->> 'para' = 'pessoa' and m.folder_id = p_rule.folder_id
          and m.user_id::text = p_effect ->> 'pessoa'
      loop
        insert into public.notifications (user_id, kind, payload, read_at)
        values (v_target, 'automation', v_payload,
                case when p_effect ->> 'canal' = 'push' then now() end);
      end loop;
      return null;

    when 'criar_tarefa' then
      select * into v_page from public.pages
      where id = case when p_effect ->> 'lista' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'lista')::uuid
                      when p_run.state #>> '{evento,lista}' ~ '^[0-9a-f-]{36}$' then (p_run.state #>> '{evento,lista}')::uuid end;
      if v_page.id is null then
        raise exception 'Escolha a lista onde criar a tarefa';
      end if;
      if p_rule.scope = 'projeto' and public.folder_root(v_page.folder_id) <> p_rule.folder_id then
        raise exception 'A lista precisa ser deste projeto';
      end if;
      v_title := left(btrim(coalesce(p_effect ->> 'titulo', '')), 500);
      if v_title = '' then
        raise exception 'A tarefa precisa de título';
      end if;
      if (p_effect ->> 'evitar_duplicar')::boolean is true then
        select id into v_id from public.tasks
        where page_id = v_page.id and status <> 'done' and lower(title) = lower(v_title) limit 1;
        if v_id is not null then
          return jsonb_build_object('tarefa', v_id, 'duplicada', true);
        end if;
      end if;
      v_id := gen_random_uuid();
      perform public.create_tasks_batch(v_page.id, jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id', v_id, 'title', v_title,
        'due_date', case when p_effect ->> 'vencimento' ~ '^\d{4}-\d{2}-\d{2}$' then p_effect ->> 'vencimento' end,
        'labels', case when jsonb_typeof(p_effect -> 'etiquetas') = 'array' then p_effect -> 'etiquetas' end))));
      return jsonb_build_object('tarefa', v_id);

    when 'atualizar_tarefa' then
      -- V14-5: só estas chaves; concluir, reabrir e apagar não existem aqui
      v_task := public._automation_task_of(p_run, p_effect);
      select * into v_row from public.tasks where id = v_task;
      if v_row.id is null then
        raise exception 'A tarefa não existe mais';
      end if;
      if not public.has_permission(v_row.folder_id, 'task.edit',
           exists (select 1 from public.task_assignees where task_id = v_row.id and user_id = auth.uid()),
           v_row.created_by = auth.uid()) then
        raise exception 'Sem permissão para mudar esta tarefa';
      end if;
      v_add := array(select lower(regexp_replace(x, '^#', '')) from jsonb_array_elements_text(
        case when jsonb_typeof(p_effect -> 'adicionar_etiquetas') = 'array' then p_effect -> 'adicionar_etiquetas' else '[]' end) x
        where btrim(x) <> '');
      v_del := array(select lower(regexp_replace(x, '^#', '')) from jsonb_array_elements_text(
        case when jsonb_typeof(p_effect -> 'remover_etiquetas') = 'array' then p_effect -> 'remover_etiquetas' else '[]' end) x);
      v_labels := array(select distinct l from unnest(coalesce(v_row.labels, '{}') || v_add) l where not l = any (v_del));
      if v_labels is distinct from v_row.labels and (cardinality(v_add) > 0 or cardinality(v_del) > 0) then
        update public.tasks set labels = v_labels where id = v_row.id;
      end if;
      if p_effect ->> 'mover_para' ~ '^[0-9a-f-]{36}$' and v_row.parent_task_id is null
         and (p_effect ->> 'mover_para')::uuid <> v_row.page_id then
        select * into v_page from public.pages where id = (p_effect ->> 'mover_para')::uuid;
        if v_page.id is null or public.folder_root(v_page.folder_id) <> public.folder_root(v_row.folder_id) then
          raise exception 'A lista de destino precisa ser do mesmo projeto';
        end if;
        update public.tasks set page_id = v_page.id where id = v_row.id;
      end if;
      if p_effect ? 'vencimento' then
        if p_effect ->> 'vencimento' ~ '^\d{4}-\d{2}-\d{2}$' then
          update public.tasks set due_date = (p_effect ->> 'vencimento')::date where id = v_row.id;
        elsif p_effect -> 'vencimento' = 'null'::jsonb then
          update public.tasks set due_date = null, due_time = null where id = v_row.id;
        end if;
      end if;
      return jsonb_build_object('tarefa', v_row.id);

    when 'atribuir' then
      if p_rule.scope <> 'projeto' then
        raise exception 'Atribuir é só em automação de projeto';
      end if;
      v_task := public._automation_task_of(p_run, p_effect);
      select * into v_row from public.tasks where id = v_task;
      if v_row.id is null or public.folder_root(v_row.folder_id) <> p_rule.folder_id then
        raise exception 'A tarefa não é deste projeto';
      end if;
      if not public.has_permission(v_row.folder_id, 'task.assign') then
        raise exception 'Sem permissão para atribuir';
      end if;
      select m.user_id into v_target from public.folder_members m
      where m.folder_id = p_rule.folder_id and m.user_id::text = p_effect ->> 'pessoa';
      if v_target is null then
        raise exception 'A pessoa não é do projeto';
      end if;
      insert into public.task_assignees (task_id, user_id) values (v_row.id, v_target) on conflict do nothing;
      return jsonb_build_object('tarefa', v_row.id, 'pessoa', v_target);

    when 'descanso' then
      -- O descanso é de quem fez a ação (concluiu a série); sem ela, da dona
      v_actor := case when p_rule.scope = 'projeto' and p_run.state #>> '{evento,por}' ~ '^[0-9a-f-]{36}$'
                      then (p_run.state #>> '{evento,por}')::uuid else p_rule.owner_id end;
      v_task := public._automation_task_of(p_run, '{}');
      v_claims := current_setting('request.jwt.claims', true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
      perform public.start_timer(gen_random_uuid(), 'rest', now(),
        least(greatest(coalesce((p_effect ->> 'segundos')::integer, 60), 5), 3600), v_task,
        jsonb_strip_nulls(jsonb_build_object('label', (select title from public.tasks where id = v_task), 'after', true)), null);
      perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
      return jsonb_build_object('para', v_actor);

    when 'executar_regra' then
      select * into v_target_rule from public.automation_rules
      where id = case when p_effect ->> 'regra' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'regra')::uuid end;
      -- Pessoal chama pessoal da mesma dona; projeto chama do mesmo projeto (o mesmo do automation_validate)
      if v_target_rule.id is null or v_target_rule.scope <> p_rule.scope
         or (p_rule.scope = 'pessoal' and v_target_rule.owner_id <> p_rule.owner_id)
         or (p_rule.scope = 'projeto' and v_target_rule.folder_id <> p_rule.folder_id) then
        raise exception 'A automação chamada não existe ou não é da mesma dona';
      end if;
      if not v_target_rule.enabled then
        raise exception 'A automação chamada está desligada';
      end if;
      v_chain := coalesce(p_run.state #> '{evento,_cadeia}', '[]') || to_jsonb(p_rule.id::text);
      if v_chain ? v_target_rule.id::text then
        raise exception 'Automação chamando a si mesma em círculo';
      end if;
      if jsonb_array_length(v_chain) >= 3 then
        raise exception 'No máximo 3 automações em sequência';
      end if;
      insert into public.automation_events (owner_id, folder_id, kind, payload)
      values (v_target_rule.owner_id, v_target_rule.folder_id, 'manual',
              coalesce(p_run.state -> 'evento', '{}') || jsonb_build_object('regra', v_target_rule.id, '_cadeia', v_chain))
      returning id into v_id;
      return jsonb_build_object('evento', v_id);

    when 'alternar_modo_jogo' then
      if p_rule.scope <> 'pessoal' then
        raise exception 'O modo jogo é preferência de cada pessoa';
      end if;
      if p_effect ->> 'modo' not in ('off', 'light', 'full') then
        raise exception 'Modo de jogo: off, light ou full';
      end if;
      update public.profiles
      set gamification_enabled = p_effect ->> 'modo' <> 'off',
          game_mode = case when p_effect ->> 'modo' = 'off' then game_mode else p_effect ->> 'modo' end
      where id = p_rule.owner_id;
      return jsonb_build_object('modo', p_effect ->> 'modo');

    else
      raise exception 'Efeito desconhecido: %', p_effect ->> 'tipo';
  end case;
end;
$$;

-- A reivindicação leva a definição guardada na execução e marca o que chegou tarde
create or replace function public.automation_claim(p_limit integer default 20)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.automation_events;
  v_out jsonb;
begin
  for v_event in
    select * from public.automation_events
    where processed_at is null and available_at <= now()
    order by available_at
    for update skip locked
    limit 100
  loop
    -- A definição vai junto com a execução: editar a regra no meio de um `esperar` não desalinha o
    -- ponteiro. Chegou tarde demais (servidor fora, fila parada)? Vira `perdido`, sem rodar (§6.2)
    insert into public.automation_runs (rule_id, event_id, state, definition, status, finished_at, error)
    select r.id, v_event.id, jsonb_build_object('evento', v_event.payload, 'var', '{}'::jsonb), r.definition,
           case when x.atraso > x.limite then 'perdido' else 'pendente' end,
           case when x.atraso > x.limite then now() end,
           case when x.atraso > x.limite then
             format('Atrasou %s min (o limite é %s)', floor(x.atraso)::integer, x.limite) end
    from public._automation_matching(v_event.kind, v_event.owner_id, v_event.folder_id, v_event.payload) r,
    lateral (select extract(epoch from now() - coalesce(
                      case when v_event.payload ->> 'previsto' ~ '^\d{4}-' then (v_event.payload ->> 'previsto')::timestamptz end,
                      v_event.created_at)) / 60 as atraso,
                    coalesce((r.definition #>> '{limites,atraso_max_min}')::integer, 15) as limite) x
    on conflict (rule_id, event_id) do nothing;
    update public.automation_events
    set processed_at = now(), claimed_at = now(), attempts = attempts + 1
    where id = v_event.id;
  end loop;

  update public.automation_runs u set status = 'cancelada', finished_at = now()
  from public.automation_rules r
  where r.id = u.rule_id and u.status in ('pendente', 'esperando') and not r.enabled;

  update public.automation_runs set status = 'falhou', finished_at = now(), error = 'O executor parou no meio 5 vezes'
  where status = 'rodando' and claimed_at < now() - interval '2 minutes' and attempts >= 5;

  with alvo as (
    select id from public.automation_runs
    where status = 'pendente'
       or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
       or (status = 'esperando' and resume_at <= now())
    order by started_at
    for update skip locked
    limit greatest(least(p_limit, 200), 1)
  ), feito as (
    update public.automation_runs u
    set status = 'rodando', claimed_at = clock_timestamp(), attempts = u.attempts + 1, resume_at = null
    from alvo where u.id = alvo.id
    returning u.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'claimed_at', f.claimed_at, 'step', f.step, 'state', f.state,
    'scope', r.scope, 'rule_id', r.id, 'rule_name', r.name, 'definition', coalesce(f.definition, r.definition),
    'fuso', coalesce(p.timezone, 'America/Sao_Paulo'), 'idioma', coalesce(p.locale, 'pt-BR'),
    'usuario', jsonb_build_object('nome', p.display_name, 'nivel', p.level, 'sequencia', p.streak,
                                  'xp', p.xp))), '[]')
  into v_out
  from feito f
  join public.automation_rules r on r.id = f.rule_id
  left join public.profiles p on p.id = r.owner_id;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Passo: também `esperando` (com a hora de voltar) e `tentar` (erro passageiro, de novo depois)
-- ---------------------------------------------------------------------------------------------
drop function public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text);
create function public.automation_step(
  p_run uuid, p_claim timestamptz, p_step integer, p_next integer, p_state jsonb,
  p_effect jsonb default null, p_log jsonb default null, p_warnings jsonb default '[]',
  p_status text default 'rodando', p_error text default null, p_resume timestamptz default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.automation_runs;
  v_rule public.automation_rules;
  v_status text := p_status;
  v_error text := p_error;
  v_log jsonb := p_log;
  v_result jsonb;
  v_resume timestamptz;
  v_claims text := current_setting('request.jwt.claims', true);
  v_depth text := current_setting('questlist.automation_depth', true);
begin
  if p_status not in ('rodando', 'ok', 'falhou', 'esperando', 'tentar') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  select * into v_run from public.automation_runs where id = p_run for update;
  if v_run.id is null or v_run.status <> 'rodando' or v_run.step <> p_step
     or v_run.claimed_at is distinct from p_claim then
    return 'ignorado';
  end if;
  select * into v_rule from public.automation_rules where id = v_run.rule_id;

  -- Erro passageiro: de novo em 1, 5 e 30 min, sem andar o passo; na quarta, falha
  if p_status = 'tentar' then
    if v_run.retries >= 3 then
      v_status := 'falhou';
      v_error := coalesce(p_error, 'Falhou depois de 3 tentativas');
    else
      update public.automation_runs set
        status = 'esperando', retries = retries + 1, error = p_error,
        resume_at = now() + (array[interval '1 minute', interval '5 minutes', interval '30 minutes'])[retries + 1],
        warnings = warnings || coalesce(p_warnings, '[]')
      where id = p_run;
      return 'ok';
    end if;
  end if;

  if p_effect is not null and v_status not in ('falhou') then
    -- Roda como a dona (D333); o que a ação gerar leva a profundidade (anti-laço)
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', v_rule.owner_id, 'role', 'authenticated')::text, true);
    perform set_config('questlist.automation_depth',
      (coalesce((v_run.state #>> '{evento,_profundidade}')::integer, 0) + 1)::text, true);
    begin
      v_result := public._automation_effect(v_run, v_rule, p_effect);
      if v_result is not null then
        v_log := coalesce(v_log, '{}') || jsonb_build_object('resultado', v_result);
      end if;
    exception when others then
      v_status := 'falhou';
      v_error := left(sqlerrm, 300);
      v_log := coalesce(p_log, '{}') || jsonb_build_object('ok', false, 'erro', v_error);
    end;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('questlist.automation_depth', coalesce(v_depth, ''), true);
  end if;

  if v_status = 'esperando' then
    -- De 1 minuto a 7 dias (o motor já calcula; o banco só não deixa passar disso)
    v_resume := least(greatest(coalesce(p_resume, now() + interval '1 minute'), now() + interval '1 minute'),
                      now() + interval '7 days');
  end if;

  update public.automation_runs set
    step = case when v_status = 'falhou' then p_step else p_next end,
    state = case when v_status = 'falhou' then state else coalesce(p_state, state) end,
    steps = case when v_log is null then steps else steps || jsonb_build_array(v_log) end,
    warnings = warnings || coalesce(p_warnings, '[]'),
    status = v_status,
    error = v_error,
    resume_at = v_resume,
    finished_at = case when v_status in ('ok', 'falhou') then now() end
  where id = p_run;

  if v_status = 'ok' then
    update public.automation_rules
    set runs = runs + 1, last_run_at = now(), consecutive_failures = 0
    where id = v_rule.id;
  elsif v_status = 'falhou' then
    update public.automation_rules
    set consecutive_failures = consecutive_failures + 1, last_run_at = now()
    where id = v_rule.id;
  end if;
  -- A tela antiga (D143) mostra as últimas execuções pelo automation_log
  if v_rule.trigger is not null and v_status in ('ok', 'falhou') then
    insert into public.automation_log (rule_id, task_id, ok, message)
    values (v_rule.id, case when v_run.state #>> '{evento,tarefa}' ~ '^[0-9a-f-]{36}$'
                            then (v_run.state #>> '{evento,tarefa}')::uuid end,
            v_status = 'ok', v_error);
  end if;
  return case when v_status = 'falhou' and p_status <> 'falhou' then 'falhou' else 'ok' end;
end;
$$;

revoke execute on function public._automation_next_run(jsonb, text, timestamptz), public.automation_rules_schedule(),
  public.profiles_timezone_automations(), public._automation_schedule(), public._automation_due_at(date, time, text),
  public._automation_scan_due(), public._automation_sweep(), public._automation_wants(text, uuid, uuid),
  public._automation_matching(text, uuid, uuid, jsonb), public.automation_emit(text, jsonb, uuid, uuid, text),
  public._automation_effect(public.automation_runs, public.automation_rules, jsonb),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.automation_claim(integer) from public, anon, authenticated;
grant execute on function public.automation_claim(integer),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz)
  to service_role;
