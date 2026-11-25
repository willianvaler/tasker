-- Motor de automações, executor mínimo (ESCOPO_V14 §6.1 a §6.3, AU2, D334).
--
-- Caminho, o mesmo do e-mail (D320): quem gera o evento chama automation_emit(), que sai sem gravar
-- nada quando a pessoa (ou o projeto) não tem regra ativa daquele tipo ou quando a transação é de
-- importação (`questlist.bulk = '1'`). O evento entra na fila `automation_events`; a inserção chama a
-- Edge Function `automation-run` pelo pg_net (endereço e segredo em `app_config`: `automation_url`,
-- `automation_secret`; sem eles, nada roda, como em desenvolvimento) e o pg_cron chama de novo a cada
-- minuto enquanto houver trabalho. O executor:
--   1. automation_claim(): transforma cada evento em uma execução por regra que casa
--      (unique (rule_id, event_id): o mesmo evento duas vezes não gera duas) e reivindica as execuções
--      com FOR UPDATE SKIP LOCKED (dois executores não pegam a mesma);
--   2. roda os passos pelo registro de tipos (supabase/functions/_shared/automation-engine.ts);
--   3. automation_step(): grava efeito e avanço do passo na mesma transação, só se a execução ainda
--      está naquele passo e com a mesma reivindicação. Efeito sai uma vez por (execução, passo).
-- O efeito roda como a dona da regra (D333): auth.uid() é ela dentro do passo.
--
-- As regras antigas da D143 (com `trigger` preenchido) seguem no caminho síncrono até o AU5; o motor
-- novo não as pega, para nada rodar duas vezes.

-- O gatilho de validação só olha o que a pessoa escreve (contadores do servidor não revalidam)
drop trigger automation_rules_check on public.automation_rules;
create trigger automation_rules_check
  before insert or update of scope, owner_id, folder_id, page_id, trigger, action, params, name, definition, enabled
  on public.automation_rules
  for each row execute function public.automation_rules_check();

alter table public.automation_runs add column claimed_at timestamptz;
create index automation_runs_pending on public.automation_runs (started_at) where status in ('pendente', 'rodando');

-- ---------------------------------------------------------------------------------------------
-- Emissão
-- ---------------------------------------------------------------------------------------------

-- Regras que casam com um evento. `manual` com `regra` no payload (Executar agora) vale só para ela,
-- seja qual for o gatilho.
create function public._automation_matching(p_kind text, p_owner uuid, p_folder uuid, p_payload jsonb)
returns setof public.automation_rules
language sql stable security definer set search_path = ''
as $$
  select r.* from public.automation_rules r
  where r.enabled and r.trigger is null
    and case when p_kind = 'manual' and p_payload ? 'regra' then r.id = (p_payload ->> 'regra')::uuid
             else r.trigger_type = p_kind
                  and ((r.scope = 'pessoal' and r.owner_id = p_owner)
                       or (r.scope = 'projeto' and r.folder_id = p_folder)) end;
$$;

-- Ponto único de entrada dos eventos. Devolve o id do evento, ou null quando nada foi gravado.
create function public.automation_emit(
  p_kind text, p_payload jsonb default '{}', p_owner uuid default null, p_folder uuid default null,
  p_dedupe text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if current_setting('questlist.bulk', true) = '1' then
    return null;
  end if;
  -- Os dois exists usam os índices parciais (owner_id, trigger_type) e (folder_id, trigger_type)
  if not exists (select 1 from public.automation_rules
                 where enabled and owner_id = p_owner and scope = 'pessoal' and trigger_type = p_kind)
     and not exists (select 1 from public.automation_rules
                     where enabled and folder_id = p_folder and trigger_type = p_kind and trigger is null) then
    return null;
  end if;
  insert into public.automation_events (owner_id, folder_id, kind, payload, dedupe_key)
  values (p_owner, p_folder, p_kind, coalesce(p_payload, '{}'), p_dedupe)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Chama o executor (sem endereço configurado, não faz nada)
create function public._automation_kick()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'automation_url');
  v_secret text := (select value from public.app_config where key = 'automation_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
end;
$$;

create function public.automation_events_kick()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_kick();
  return null;
end;
$$;
-- Uma chamada por comando, não por linha
create trigger automation_events_kick after insert on public.automation_events
  for each statement execute function public.automation_events_kick();

-- Executar agora (V14 §6.5): a dona da regra pessoal ou quem mexe nas automações do projeto
create function public.automation_run_now(p_rule uuid)
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
  if v_rule.trigger is not null then
    raise exception 'Esta automação ainda roda pelo caminho antigo' using errcode = '22023';
  end if;
  insert into public.automation_events (owner_id, folder_id, kind, payload)
  values (v_rule.owner_id, v_rule.folder_id, 'manual', jsonb_build_object('regra', v_rule.id, 'por', auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Executor: reivindicar e gravar passo (só a chave de serviço, pela Edge Function)
-- ---------------------------------------------------------------------------------------------

-- Eventos viram execuções; devolve as execuções reivindicadas, com a definição da regra
create function public.automation_claim(p_limit integer default 20)
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
    insert into public.automation_runs (rule_id, event_id, state)
    select r.id, v_event.id, jsonb_build_object('evento', v_event.payload, 'var', '{}'::jsonb)
    from public._automation_matching(v_event.kind, v_event.owner_id, v_event.folder_id, v_event.payload) r
    on conflict (rule_id, event_id) do nothing;
    update public.automation_events
    set processed_at = now(), claimed_at = now(), attempts = attempts + 1
    where id = v_event.id;
  end loop;

  -- Regra desligada (ou de volta ao caminho antigo) no meio do caminho: a execução não roda
  update public.automation_runs u set status = 'cancelada', finished_at = now()
  from public.automation_rules r
  where r.id = u.rule_id and u.status in ('pendente', 'esperando') and (not r.enabled or r.trigger is not null);

  -- Reivindicação perdida (executor caiu) volta depois de 2 minutos; depois de 5 vezes, falha
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
    'scope', r.scope, 'rule_id', r.id, 'rule_name', r.name, 'definition', r.definition)), '[]')
  into v_out
  from feito f join public.automation_rules r on r.id = f.rule_id;
  return v_out;
end;
$$;

-- Efeito de um passo, como a dona da regra
create function public._automation_effect(p_run public.automation_runs, p_rule public.automation_rules, p_effect jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task uuid;
  v_title text;
  v_target uuid;
  v_payload jsonb;
begin
  case p_effect ->> 'tipo'
    when 'notificacao' then
      if p_rule.scope = 'projeto' and not public.is_folder_member(p_rule.folder_id) then
        raise exception 'Quem criou a automação não está mais no projeto';
      end if;
      v_task := case when p_run.state #>> '{evento,tarefa}' ~ '^[0-9a-f-]{36}$'
                     then (p_run.state #>> '{evento,tarefa}')::uuid end;
      v_title := (select title from public.tasks where id = v_task);
      v_payload := jsonb_strip_nulls(jsonb_build_object(
        'rule_id', p_rule.id, 'rule_name', p_rule.name,
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
    else
      raise exception 'Efeito desconhecido: %', p_effect ->> 'tipo';
  end case;
end;
$$;

-- Grava um passo. 'ok' gravado; 'ignorado' quando a execução já passou deste passo ou foi
-- reivindicada de novo; 'falhou' quando o efeito deu erro (a execução fica `falhou`).
create function public.automation_step(
  p_run uuid, p_claim timestamptz, p_step integer, p_next integer, p_state jsonb,
  p_effect jsonb default null, p_log jsonb default null, p_warnings jsonb default '[]',
  p_status text default 'rodando', p_error text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.automation_runs;
  v_rule public.automation_rules;
  v_status text := p_status;
  v_error text := p_error;
  v_log jsonb := p_log;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if p_status not in ('rodando', 'ok', 'falhou') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  select * into v_run from public.automation_runs where id = p_run for update;
  if v_run.id is null or v_run.status <> 'rodando' or v_run.step <> p_step
     or v_run.claimed_at is distinct from p_claim then
    return 'ignorado';
  end if;
  select * into v_rule from public.automation_rules where id = v_run.rule_id;

  if p_effect is not null and v_status <> 'falhou' then
    -- Roda como a dona (D333): permissões e guardas veem ela
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', v_rule.owner_id, 'role', 'authenticated')::text, true);
    begin
      perform public._automation_effect(v_run, v_rule, p_effect);
    exception when others then
      v_status := 'falhou';
      v_error := left(sqlerrm, 300);
      v_log := coalesce(p_log, '{}') || jsonb_build_object('ok', false, 'erro', v_error);
    end;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  end if;

  update public.automation_runs set
    step = case when v_status = 'falhou' then p_step else p_next end,
    state = case when v_status = 'falhou' then state else coalesce(p_state, state) end,
    steps = case when v_log is null then steps else steps || jsonb_build_array(v_log) end,
    warnings = warnings || coalesce(p_warnings, '[]'),
    status = v_status,
    error = v_error,
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
  return case when v_status = 'falhou' and p_status <> 'falhou' then 'falhou' else 'ok' end;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Varredor e retenção (V14 §6.2)
-- ---------------------------------------------------------------------------------------------

-- A cada minuto: se há evento parado ou execução pronta para seguir, chama o executor
create function public._automation_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.automation_events where processed_at is null and available_at <= now())
     or exists (select 1 from public.automation_runs
                where status = 'pendente'
                   or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
                   or (status = 'esperando' and resume_at <= now())) then
    perform public._automation_kick();
  end if;
end;
$$;
select cron.schedule('automacoes-varredor', '* * * * *', $$select public._automation_sweep()$$);
select cron.schedule('automacoes-retencao', '47 4 * * *', $$
  delete from public.automation_events where created_at < now() - interval '7 days';
  delete from public.automation_runs where started_at < now() - interval '30 days'
    and status not in ('pendente', 'rodando', 'esperando');
$$);

-- O aviso "só no app" não vai para o celular
create or replace function public.notifications_send_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'push_url');
  v_secret text := (select value from public.app_config where key = 'push_secret');
begin
  if v_url is null or v_secret is null
     or new.payload ->> 'push' = 'false'
     or not exists (select 1 from public.push_tokens where user_id = new.user_id) then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
  return null;
end;
$$;

revoke execute on function public._automation_matching(text, uuid, uuid, jsonb),
  public.automation_emit(text, jsonb, uuid, uuid, text), public._automation_kick(),
  public.automation_events_kick(), public.automation_claim(integer),
  public._automation_effect(public.automation_runs, public.automation_rules, jsonb),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text),
  public._automation_sweep(), public.notifications_send_push()
  from public, anon, authenticated;
grant execute on function public.automation_claim(integer),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text)
  to service_role;
revoke execute on function public.automation_run_now(uuid) from public, anon;
grant execute on function public.automation_run_now(uuid) to authenticated;
