-- V3 §2.7 (I1): auditoria do fluxo. `task_events` é só inserção: os triggers gravam o que aconteceu
-- com cada tarefa (quem, quando e o quê), e o registro continua depois que a tarefa é apagada.
-- Ver: quem tem workflow.view_audit no projeto (padrão: Dono, Gerente e Editor) ou o dono da pasta
-- pessoal.

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  -- Sem chave estrangeira: o histórico sobrevive à tarefa apagada
  task_id uuid not null,
  -- Pasta raiz (projeto); some junto com ela (trigger em folders)
  root_id uuid not null,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'created', 'restored', 'renamed', 'assigned', 'unassigned', 'started', 'stopped', 'ready',
    'blocked', 'completed', 'reopened', 'forced', 'dependency_added', 'dependency_removed',
    'moved', 'deleted')),
  -- Hora do relógio, não da transação: os eventos de uma mesma ação ficam na ordem em que aconteceram
  at timestamptz not null default clock_timestamp(),
  payload jsonb not null default '{}'
);
create index task_events_task on public.task_events (task_id, at desc);
create index task_events_root on public.task_events (root_id, at desc);

alter table public.task_events enable row level security;
revoke insert, update, delete, truncate on public.task_events from anon, authenticated;

create function public.can_view_audit(p_root uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_permission(p_root, 'workflow.view_audit')
      or exists (select 1 from public.folders where id = p_root and owner_id = auth.uid() and team_id is null);
$$;
grant execute on function public.can_view_audit(uuid) to authenticated;

create policy "task_events: quem audita o projeto vê"
  on public.task_events for select to authenticated
  using (public.can_view_audit(root_id));

-- Grava um evento (o projeto que sumiu no meio de uma exclusão em cascata não grava)
create function public._task_event(p_task_id uuid, p_folder_id uuid, p_kind text, p_payload jsonb default '{}')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
begin
  if v_root is null then
    return;
  end if;
  insert into public.task_events (task_id, root_id, user_id, kind, payload)
  values (p_task_id, v_root, auth.uid(), p_kind, coalesce(p_payload, '{}'));
end;
$$;

create function public._page_title(p_page_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select name from public.pages where id = p_page_id $$;

-- Tarefa: criada, renomeada, iniciada, concluída, reaberta, movida, apagada
create function public.tasks_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_base jsonb;
begin
  if tg_op = 'DELETE' then
    perform public._task_event(old.id, old.folder_id, 'deleted', jsonb_build_object('title', old.title));
    return null;
  end if;

  v_base := jsonb_build_object('title', new.title);
  if tg_op = 'INSERT' then
    -- Já teve histórico: voltou da lixeira
    perform public._task_event(new.id, new.folder_id,
      case when exists (select 1 from public.task_events where task_id = new.id) then 'restored' else 'created' end,
      v_base || jsonb_build_object('page', public._page_title(new.page_id)));
    return null;
  end if;

  if new.title is distinct from old.title then
    perform public._task_event(new.id, new.folder_id, 'renamed', v_base || jsonb_build_object('from', old.title));
  end if;
  if new.page_id is distinct from old.page_id then
    perform public._task_event(new.id, new.folder_id, 'moved', v_base || jsonb_build_object(
      'from', public._page_title(old.page_id), 'to', public._page_title(new.page_id)));
  end if;
  if new.status is distinct from old.status or new.started_at is distinct from old.started_at then
    if current_setting('app.force_unblock', true) = new.id::text then
      perform public._task_event(new.id, new.folder_id, 'forced', v_base || jsonb_build_object(
        'action', case when new.status = 'done' then 'complete' else 'start' end,
        'waiting', (select jsonb_agg(title) from public.tasks where id = any (public.task_blockers(new.id)))));
    end if;
    if new.status = 'done' and old.status <> 'done' then
      perform public._task_event(new.id, new.folder_id, 'completed', v_base);
    elsif old.status = 'done' and new.status <> 'done' then
      perform public._task_event(new.id, new.folder_id, 'reopened', v_base);
    elsif new.started_at is not null and old.started_at is null then
      perform public._task_event(new.id, new.folder_id, 'started', v_base);
    elsif new.started_at is null and old.started_at is not null then
      perform public._task_event(new.id, new.folder_id, 'stopped', v_base);
    end if;
  end if;
  return null;
end;
$$;

create trigger tasks_events
  after insert or delete or update of title, page_id, status, started_at on public.tasks
  for each row execute function public.tasks_events();

-- Responsáveis
create function public.task_assignees_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.task_assignees := case when tg_op = 'DELETE' then old else new end;
  v_name text;
begin
  -- A tarefa sumiu junto (exclusão em cascata): o "deleted" da tarefa basta
  if not exists (select 1 from public.tasks where id = v_row.task_id) then
    return null;
  end if;
  select coalesce(p.display_name, v_row.pending_name) into v_name
  from (select 1) x left join public.profiles p on p.id = v_row.user_id;
  perform public._task_event(v_row.task_id, v_row.folder_id,
    case when tg_op = 'DELETE' then 'unassigned' else 'assigned' end,
    jsonb_build_object('title', (select title from public.tasks where id = v_row.task_id),
                       'name', coalesce(v_name, v_row.pending_name), 'user_id', v_row.user_id));
  return null;
end;
$$;

create trigger task_assignees_events
  after insert or delete on public.task_assignees
  for each row execute function public.task_assignees_events();

-- Ligações: ligar e desligar, e o bloqueio/liberação que isso causa
create function public.task_dependencies_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.task_dependencies := case when tg_op = 'DELETE' then old else new end;
  v_task public.tasks;
  v_prereq text;
  v_open integer;
begin
  select * into v_task from public.tasks where id = v_row.task_id;
  if v_task.id is null then
    return null;
  end if;
  select title into v_prereq from public.tasks where id = v_row.depends_on_task_id;
  perform public._task_event(v_task.id, v_task.folder_id,
    case when tg_op = 'DELETE' then 'dependency_removed' else 'dependency_added' end,
    jsonb_build_object('title', v_task.title, 'prereq', v_prereq, 'prereq_id', v_row.depends_on_task_id,
                       'lag', v_row.lag_minutes));
  if v_task.status = 'done' then
    return null;
  end if;

  v_open := cardinality(public.task_blockers(v_task.id));
  if tg_op = 'INSERT' and v_open > 0 and not public._dependency_ok(new, now())
     and v_open = (select count(*) from unnest(public.task_blockers(v_task.id)) b where b = new.depends_on_task_id) then
    -- Só esta ligação segura: a tarefa passou a esperar agora
    perform public._task_event(v_task.id, v_task.folder_id, 'blocked',
      jsonb_build_object('title', v_task.title, 'prereq', v_prereq));
  elsif tg_op = 'DELETE' and v_open = 0 and not public._dependency_ok(old, now()) then
    perform public._task_event(v_task.id, v_task.folder_id, 'ready',
      jsonb_build_object('title', v_task.title, 'prereq', v_prereq));
  end if;
  return null;
end;
$$;

create trigger task_dependencies_events
  after insert or delete on public.task_dependencies
  for each row execute function public.task_dependencies_events();

-- Avisos do fluxo (H4) passam a gravar "ficou pronta" e "voltou a esperar"
create or replace function public.tasks_flow_notify()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_dep public.task_dependencies;
  v_task public.tasks;
  v_lag integer;
  v_open integer;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  for v_dep in select * from public.task_dependencies where depends_on_task_id = new.id loop
    select * into v_task from public.tasks where id = v_dep.task_id;
    continue when v_task.id is null or v_task.status = 'done';

    if new.status = 'done' then
      -- Libera se nada mais segura (ou só falta o atraso desta ligação)
      select count(*) into v_open
      from unnest(public.task_blockers(v_task.id, now() + make_interval(mins => v_dep.lag_minutes))) b;
      continue when v_open > 0;
      v_lag := v_dep.lag_minutes;
      perform public._task_event(v_task.id, v_task.folder_id, 'ready', jsonb_build_object(
        'title', v_task.title, 'prereq', new.title, 'lag', v_lag));
      perform public._notify(p, 'task_ready', jsonb_build_object(
        'task_id', v_task.id, 'title', v_task.title, 'prereq', new.title, 'lag', v_lag))
      from public._task_people(v_task.id) p;
    elsif old.status = 'done' then
      -- Reaberto: quem dependia volta a esperar (avisa quem já tinha começado)
      if cardinality(public.task_blockers(v_task.id)) = 1 then
        perform public._task_event(v_task.id, v_task.folder_id, 'blocked', jsonb_build_object(
          'title', v_task.title, 'prereq', new.title));
      end if;
      if v_task.started_at is not null then
        perform public._notify(p, 'prereq_reopened', jsonb_build_object(
          'task_id', v_task.id, 'title', v_task.title, 'prereq', new.title))
        from public._task_people(v_task.id) p;
      end if;
    end if;
  end loop;
  return null;
end;
$$;

-- Projeto apagado leva o histórico junto
create function public.folders_drop_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.parent_id is null then
    delete from public.task_events where root_id = old.id;
  end if;
  return null;
end;
$$;

create trigger folders_drop_events
  after delete on public.folders
  for each row execute function public.folders_drop_events();

revoke execute on function public._task_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public._page_title(uuid) from public, anon, authenticated;
