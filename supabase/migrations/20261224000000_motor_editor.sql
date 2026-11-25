-- Motor de automações: o editor (ESCOPO_V14 §9, AU7, D341).
--
-- - Regra antiga (D143) aberta e salva no editor novo vira regra no formato novo: as colunas
--   antigas (`trigger`, `action`, `params`, `page_id`) saem, a definição nova vale.
-- - `usuario.atrasadas`: quantas tarefas da dona estão atrasadas (para "às 19:00, se há atrasadas,
--   avisar", um dos modelos).

-- Tarefas atrasadas da pessoa: atribuídas a ela, ou criadas por ela sem ninguém atribuído
create function public._automation_overdue_count(p_owner uuid, p_tz text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.tasks t
  where t.status <> 'done' and t.due_date < (now() at time zone coalesce(nullif(p_tz, ''), 'America/Sao_Paulo'))::date
    and t.due_date > (now() at time zone coalesce(nullif(p_tz, ''), 'America/Sao_Paulo'))::date - 365
    and (exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = p_owner)
         or (t.created_by = p_owner and not exists (select 1 from public.task_assignees a where a.task_id = t.id)));
$$;

-- Editar a regra antiga no editor novo a converte
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

  -- Regra antiga editada no editor novo (AU7): a definição nova vale e as colunas antigas saem
  if tg_op = 'UPDATE' and old.trigger is not null and new.definition is distinct from old.definition
     and new.trigger is not distinct from old.trigger and new.action is not distinct from old.action
     and new.params is not distinct from old.params and new.page_id is not distinct from old.page_id then
    new.trigger := null;
    new.action := null;
    new.params := '{}';
    new.page_id := null;
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

-- O executor recebe também as atrasadas da dona
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
                                  'xp', p.xp, 'atrasadas', public._automation_overdue_count(r.owner_id, p.timezone)))), '[]')
  into v_out
  from feito f
  join public.automation_rules r on r.id = f.rule_id
  left join public.profiles p on p.id = r.owner_id;
  return v_out;
end;
$$;

revoke execute on function public._automation_overdue_count(uuid, text), public.automation_rules_check(),
  public.automation_claim(integer) from public, anon, authenticated;
grant execute on function public.automation_claim(integer) to service_role;
