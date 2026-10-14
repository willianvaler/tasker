-- V3 §2.2 (H3): iniciar tarefa e modo de dependência do projeto. Estrito (padrão, D106): tarefa
-- bloqueada não inicia nem conclui. Flexível: quem tem task.force_unblock pode forçar, com registro.
-- "Em andamento" é uma coisa só: started_at e o status 'doing' (a coluna "Fazendo" do kanban)
-- andam juntos.

alter table public.folders add column dependency_mode text not null default 'strict'
  check (dependency_mode in ('strict', 'flexible'));
grant update (dependency_mode) on public.folders to authenticated;

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'task_completed', 'tasks_created', 'member_joined', 'comment_added', 'assignee_claimed',
  'boss_started', 'boss_defeated', 'project_team_changed', 'task_forced'));

-- started_at e status 'doing' juntos
create function public.tasks_sync_started()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'doing' and new.started_at is null then
    new.started_at := now();
  elsif new.status = 'todo' and tg_op = 'UPDATE' and old.status <> 'todo' then
    -- Voltou para "a fazer" (kanban ou reaberta): deixa de estar em andamento
    new.started_at := null;
  elsif new.started_at is not null and new.status = 'todo' then
    new.status := 'doing';
  end if;
  return new;
end;
$$;

create trigger tasks_sync_started
  before insert or update of status, started_at on public.tasks
  for each row execute function public.tasks_sync_started();

-- Tarefa bloqueada não começa nem termina (vale para a ação de primeiro nível do app; o que um
-- trigger faz em cascata já foi decidido antes). Forçar: só no modo flexível, por RPC.
create function public.tasks_respect_blockers()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_waiting uuid[];
begin
  if public._app_caller() is null then
    return new;
  end if;
  if not ((new.status in ('doing', 'done') and old.status is distinct from new.status)
          or (new.started_at is not null and old.started_at is null)) then
    return new;
  end if;
  if current_setting('app.force_unblock', true) = new.id::text then
    return new;
  end if;
  v_waiting := public.task_blockers(new.id);
  if cardinality(v_waiting) > 0 then
    raise exception 'Tarefa bloqueada. Aguardando: %',
      (select string_agg(title, ', ') from public.tasks where id = any (v_waiting))
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger tasks_respect_blockers
  before update of status, started_at on public.tasks
  for each row execute function public.tasks_respect_blockers();

-- Mãe que fecharia sozinha, mas está bloqueada, espera
create or replace function public.tasks_parent_follow()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.tasks;
  v_auto boolean;
begin
  if new.parent_task_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  select * into v_parent from public.tasks where id = new.parent_task_id;
  if v_parent.id is null then
    return null;
  end if;

  if new.status = 'done' and v_parent.status <> 'done' then
    select r.auto_complete_parent into v_auto
    from public.folders f join public.folders r on r.id = coalesce(f.parent_id, f.id)
    where f.id = v_parent.folder_id;
    if coalesce(v_auto, true)
       and not exists (select 1 from public.tasks where parent_task_id = v_parent.id and status <> 'done')
       and cardinality(public.task_blockers(v_parent.id)) = 0 then
      perform public.complete_task(v_parent.id);
    end if;
  elsif old.status = 'done' and new.status <> 'done' and v_parent.status = 'done' then
    perform public.uncomplete_task(v_parent.id);
  end if;
  return null;
end;
$$;

-- Iniciar (S) e parar. O Colaborador inicia o que é dele (task.start:own).
create function public.start_task(p_task_id uuid, p_started boolean default true)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_task.folder_id, 'task.start',
                               public.is_task_assignee(v_task.id, auth.uid()), v_task.created_by = auth.uid()) then
    raise exception 'Seu cargo não inicia esta tarefa' using errcode = '42501';
  end if;
  if v_task.status = 'done' then
    return v_task;
  end if;
  update public.tasks
  set started_at = case when p_started then coalesce(started_at, now()) end,
      status = case when p_started then 'doing' else 'todo' end::public.task_status
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

-- Forçar (modo flexível): inicia ou conclui uma tarefa bloqueada, e registra
create function public.force_task(p_task_id uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_mode text;
  v_result jsonb;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  select r.dependency_mode into v_mode
  from public.folders f join public.folders r on r.id = coalesce(f.parent_id, f.id)
  where f.id = v_task.folder_id;
  if v_mode is distinct from 'flexible' then
    raise exception 'Este projeto está no modo estrito: tarefas bloqueadas esperam os pré-requisitos'
      using errcode = '42501';
  end if;
  if not public.has_permission(v_task.folder_id, 'task.force_unblock') then
    raise exception 'Seu cargo não força tarefas bloqueadas' using errcode = '42501';
  end if;
  if p_action not in ('start', 'complete') then
    raise exception 'Ação desconhecida: %', p_action using errcode = '22023';
  end if;

  perform set_config('app.force_unblock', p_task_id::text, true);
  if p_action = 'start' then
    v_result := to_jsonb(public.start_task(p_task_id, true));
  else
    v_result := public.complete_task(p_task_id);
  end if;
  perform set_config('app.force_unblock', '', true);

  perform public._log_activity(public.folder_root(v_task.folder_id), 'task_forced', jsonb_build_object(
    'task_id', p_task_id, 'title', v_task.title, 'action', p_action,
    'waiting', (select jsonb_agg(title) from public.tasks where id = any (public.task_blockers(p_task_id)))));
  return v_result;
end;
$$;

grant execute on function public.start_task(uuid, boolean) to authenticated;
grant execute on function public.force_task(uuid, text) to authenticated;

-- Iniciar também pela fila do aparelho (offline)
create or replace function public.run_once(p_key uuid, p_name text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.applied_ops (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'complete_tree' then
      return jsonb_build_object('count', public.complete_tree((p_args ->> 'p_task_id')::uuid));
    when 'start_task' then
      return to_jsonb(public.start_task((p_args ->> 'p_task_id')::uuid,
                                        coalesce((p_args ->> 'p_started')::boolean, true)));
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;
