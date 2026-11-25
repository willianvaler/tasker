-- Motor de automações: limites, desligar depois de falhas, Pausar todas e uso da hora
-- (ESCOPO_V14 §6.4 e §6.5, AU6, D338).
--
-- - Na reivindicação, cada execução nova passa pelos limites (`_automation_limited`): intervalo de
--   espera da regra (cooldown), 60 por regra e 600 por pessoa na última hora. Passou: nasce
--   `limitada` (não `falhou`), com o motivo, e aparece no histórico.
-- - `notificar`: até 10 avisos por hora por regra e pessoa; o 11º deixa a execução `limitada`.
-- - 10 falhas seguidas desligam a regra (`disabled_reason = 'falhas'`) e avisam a dona uma vez.
-- - Pausar todas (`automations_paused` no perfil, por `set_automations_paused`): nenhuma regra da
--   pessoa casa com evento novo, e as execuções pendentes, em espera ou no meio são canceladas.
-- - Os valores ficam em `app_config` (só o dono do app muda): automation_limit_rule_hour,
--   automation_limit_owner_hour, automation_limit_notify_hour, automation_max_failures.
-- O tempo ativo de 30 s por execução é do executor; o Testar roda o motor no aparelho, sem gravar.

alter table public.profiles add column automations_paused boolean not null default false;

create function public._automation_limit(p_key text, p_default integer)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select nullif(value, '')::integer from public.app_config where key = p_key), p_default);
$$;

-- Por que a execução nova não pode rodar (ou null)
create function public._automation_limited(p_rule public.automation_rules)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cooldown integer := coalesce((p_rule.definition #>> '{limites,cooldown_min}')::integer, 0);
  v_rule_max integer := public._automation_limit('automation_limit_rule_hour', 60);
  v_owner_max integer := public._automation_limit('automation_limit_owner_hour', 600);
begin
  if v_cooldown > 0 and exists (
    select 1 from public.automation_runs
    where rule_id = p_rule.id and started_at > now() - make_interval(mins => v_cooldown)
      and status in ('pendente', 'rodando', 'esperando', 'ok', 'falhou')) then
    return format('Intervalo de espera da automação (%s min)', v_cooldown);
  end if;
  if (select count(*) from public.automation_runs
      where rule_id = p_rule.id and started_at > now() - interval '1 hour'
        and status in ('pendente', 'rodando', 'esperando', 'ok', 'falhou')) >= v_rule_max then
    return format('Limite de %s execuções por hora desta automação', v_rule_max);
  end if;
  if (select count(*) from public.automation_runs x
      join public.automation_rules r on r.id = x.rule_id
      where r.owner_id = p_rule.owner_id and x.started_at > now() - interval '1 hour'
        and x.status in ('pendente', 'rodando', 'esperando', 'ok', 'falhou')) >= v_owner_max then
    return format('Limite de %s execuções por hora das suas automações', v_owner_max);
  end if;
  return null;
end;
$$;

-- Regras que casam: sem as de quem pausou tudo
create or replace function public._automation_matching(p_kind text, p_owner uuid, p_folder uuid, p_payload jsonb)
returns setof public.automation_rules
language sql stable security definer set search_path = ''
as $$
  select r.* from public.automation_rules r
  where r.enabled
    and not exists (select 1 from public.profiles p where p.id = r.owner_id and p.automations_paused)
    and case when p_payload ? 'regra' then r.id = (p_payload ->> 'regra')::uuid
             else r.trigger_type = p_kind
                  and ((r.scope = 'pessoal' and r.owner_id = p_owner)
                       or (r.scope = 'projeto' and r.folder_id = p_folder))
                  and (r.definition #>> '{gatilho,lista}' is null
                       or r.definition #>> '{gatilho,lista}' = p_payload ->> 'lista') end;
$$;

-- Pausar todas (e voltar): vale na hora, inclusive para o que está esperando
create function public.set_automations_paused(p_paused boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  update public.profiles set automations_paused = p_paused where id = auth.uid();
  if p_paused then
    update public.automation_runs x set status = 'cancelada', finished_at = now(), error = 'Automações pausadas'
    from public.automation_rules r
    where r.id = x.rule_id and r.owner_id = auth.uid() and x.status in ('pendente', 'esperando');
  end if;
  return p_paused;
end;
$$;

-- Para a tela: pausado, uso da hora e os limites
create function public.automation_usage()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'pausado', coalesce((select automations_paused from public.profiles where id = auth.uid()), false),
    'hora', (select count(*) from public.automation_runs x join public.automation_rules r on r.id = x.rule_id
             where r.owner_id = auth.uid() and x.started_at > now() - interval '1 hour'
               and x.status in ('pendente', 'rodando', 'esperando', 'ok', 'falhou')),
    'limite_hora', public._automation_limit('automation_limit_owner_hour', 600),
    'limite_regra_hora', public._automation_limit('automation_limit_rule_hour', 60),
    'limite_avisos_hora', public._automation_limit('automation_limit_notify_hour', 10),
    'falhas_para_desligar', public._automation_limit('automation_max_failures', 10))
  where auth.uid() is not null;
$$;


-- Desligar não revalida a regra (o servidor desliga depois de falhas sem depender da definição)
create or replace function public.automation_rules_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(auth.uid(), new.owner_id, new.created_by);
    new.consecutive_failures := 0;
    new.disabled_reason := null;
    new.runs := 0;
    new.last_run_at := null;
  elsif new.scope <> old.scope or new.owner_id is distinct from old.owner_id
        or new.folder_id is distinct from old.folder_id then
    perform public._automation_fail('Escopo, dona e projeto da automação não mudam');
  end if;

  -- Só desligar (a pessoa ou o servidor depois de falhas): não precisa validar de novo
  if tg_op = 'UPDATE' and not new.enabled and old.enabled and new.definition is not distinct from old.definition
     and new.name is not distinct from old.name and new.trigger is not distinct from old.trigger
     and new.params is not distinct from old.params then
    new.updated_at := now();
    return new;
  end if;

  if new.scope = 'projeto' then
    if (select parent_id from public.folders where id = new.folder_id) is not null then
      perform public._automation_fail('A regra vale para a pasta principal (o projeto)');
    end if;
    if new.page_id is not null and (select public.folder_root(folder_id) from public.pages where id = new.page_id) <> new.folder_id then
      perform public._automation_fail('A página precisa ser desta pasta');
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.automation_rules where folder_id = new.folder_id) >= 20 then
      perform public._automation_fail('No máximo 20 automações por projeto');
    end if;
  elsif tg_op = 'INSERT' and (select count(*) from public.automation_rules where owner_id = new.owner_id and scope = 'pessoal') >= 100 then
    perform public._automation_fail('No máximo 100 automações pessoais');
  end if;

  -- Regra antiga (D143): a definição vem das colunas antigas, que a tela antiga ainda grava
  if new.trigger is not null then
    new.definition := public._automation_from_legacy(new.trigger, new.action, new.params, new.page_id);
    if new.name = '' then
      new.name := public._automation_legacy_name(new.trigger, new.action);
    end if;
  elsif char_length(btrim(new.name)) = 0 then
    perform public._automation_fail('A automação precisa de um nome');
  end if;

  perform public.automation_validate(new.definition, new.scope, new.owner_id, new.folder_id, new.id);
  new.trigger_type := new.definition #>> '{gatilho,tipo}';

  -- Religar zera as falhas
  if tg_op = 'UPDATE' and new.enabled and not old.enabled then
    new.consecutive_failures := 0;
    new.disabled_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Execuções novas passam pelos limites; as de quem pausou tudo são canceladas
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
           case when x.atraso > x.limite then 'perdido' when l.motivo is not null then 'limitada' else 'pendente' end,
           case when x.atraso > x.limite or l.motivo is not null then now() end,
           case when x.atraso > x.limite then
             format('Atrasou %s min (o limite é %s)', floor(x.atraso)::integer, x.limite) else l.motivo end
    from public._automation_matching(v_event.kind, v_event.owner_id, v_event.folder_id, v_event.payload) r,
    lateral (select extract(epoch from now() - coalesce(
                      case when v_event.payload ->> 'previsto' ~ '^\d{4}-' then (v_event.payload ->> 'previsto')::timestamptz end,
                      v_event.created_at)) / 60 as atraso,
                    coalesce((r.definition #>> '{limites,atraso_max_min}')::integer, 15) as limite) x,
    lateral (select public._automation_limited(r) as motivo) l
    on conflict (rule_id, event_id) do nothing;
    update public.automation_events
    set processed_at = now(), claimed_at = now(), attempts = attempts + 1
    where id = v_event.id;
  end loop;

  update public.automation_runs u set status = 'cancelada', finished_at = now()
  from public.automation_rules r
  where r.id = u.rule_id and u.status in ('pendente', 'esperando')
    and (not r.enabled or exists (select 1 from public.profiles p where p.id = r.owner_id and p.automations_paused));

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

-- Avisos com limite por hora
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
      -- Até 10 avisos por hora por regra e pessoa (V14 §5); passando disso, a execução fica `limitada`
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
        if (select count(*) from public.notifications n
            where n.user_id = v_target and n.kind = 'automation' and n.created_at > now() - interval '1 hour'
              and n.payload ->> 'automation_rule' = p_rule.id::text) >= public._automation_limit('automation_limit_notify_hour', 10) then
          raise exception 'Limite de avisos por hora desta automação' using errcode = 'QL429';
        end if;
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

-- Passo: pausa e desligada param na hora; limitada; desligar depois de falhas seguidas
create or replace function public.automation_step(
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
  v_failures integer;
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
  -- Desligada ou com tudo pausado no meio da execução: para aqui (Pausar todas, V14 §6.5)
  if not v_rule.enabled or (select automations_paused from public.profiles where id = v_rule.owner_id) then
    update public.automation_runs set status = 'cancelada', finished_at = now(),
      error = case when v_rule.enabled then 'Automações pausadas' else 'Automação desligada' end
    where id = p_run;
    return 'ignorado';
  end if;

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
    exception when sqlstate 'QL429' then
      v_status := 'limitada';
      v_error := left(sqlerrm, 300);
      v_log := coalesce(p_log, '{}') || jsonb_build_object('ok', false, 'erro', v_error);
    when others then
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
    finished_at = case when v_status in ('ok', 'falhou', 'limitada') then now() end
  where id = p_run;

  if v_status = 'ok' then
    update public.automation_rules
    set runs = runs + 1, last_run_at = now(), consecutive_failures = 0
    where id = v_rule.id;
  elsif v_status = 'falhou' then
    update public.automation_rules
    set consecutive_failures = consecutive_failures + 1, last_run_at = now()
    where id = v_rule.id
    returning consecutive_failures into v_failures;
    -- Falhas seguidas demais: desliga e avisa a dona uma vez (V14 §6.1)
    if v_failures >= public._automation_limit('automation_max_failures', 10) then
      update public.automation_rules set enabled = false, disabled_reason = 'falhas' where id = v_rule.id;
      insert into public.notifications (user_id, kind, payload)
      values (v_rule.owner_id, 'automation', jsonb_build_object(
        'rule_id', v_rule.id, 'automation_rule', v_rule.id, 'rule_name', v_rule.name,
        'titulo', 'Automação desligada',
        'message', format('"%s" falhou %s vezes seguidas e foi desligada. Veja o histórico e ligue de novo.',
                          v_rule.name, v_failures)));
    end if;
  end if;
  -- A tela antiga (D143) mostra as últimas execuções pelo automation_log
  if v_rule.trigger is not null and v_status in ('ok', 'falhou', 'limitada') then
    insert into public.automation_log (rule_id, task_id, ok, message)
    values (v_rule.id, case when v_run.state #>> '{evento,tarefa}' ~ '^[0-9a-f-]{36}$'
                            then (v_run.state #>> '{evento,tarefa}')::uuid end,
            v_status = 'ok', v_error);
  end if;
  return case when v_status = 'falhou' and p_status <> 'falhou' then 'falhou' else 'ok' end;
end;
$$;

revoke execute on function public._automation_limit(text, integer), public._automation_limited(public.automation_rules),
  public._automation_matching(text, uuid, uuid, jsonb),
  public._automation_effect(public.automation_runs, public.automation_rules, jsonb),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz),
  public.automation_claim(integer), public.automation_rules_check()
  from public, anon, authenticated;
grant execute on function public.automation_claim(integer),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz)
  to service_role;
revoke execute on function public.set_automations_paused(boolean), public.automation_usage() from public, anon;
grant execute on function public.set_automations_paused(boolean), public.automation_usage() to authenticated;
