-- V3 §2.2 (H4): avisos do fluxo. Concluir um pré-requisito que libera outra tarefa avisa quem
-- vai fazê-la ("O carvão foi comprado: já pode acender o fogo"); reabrir um pré-requisito avisa
-- quem já tinha começado a tarefa que dependia dele. Quem recebe: os responsáveis (sem nenhum, quem
-- criou a tarefa). Quem fez a ação não é avisado (_notify).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested',
  'join_approved', 'task_ready', 'prereq_reopened'));

-- Quem cuida da tarefa
create function public._task_people(p_task_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from public.task_assignees where task_id = p_task_id and user_id is not null
  union
  select t.created_by from public.tasks t
  where t.id = p_task_id and t.created_by is not null
    and not exists (select 1 from public.task_assignees a where a.task_id = p_task_id and a.user_id is not null);
$$;

create function public.tasks_flow_notify()
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
      perform public._notify(p, 'task_ready', jsonb_build_object(
        'task_id', v_task.id, 'title', v_task.title, 'prereq', new.title, 'lag', v_lag))
      from public._task_people(v_task.id) p;
    elsif old.status = 'done' and v_task.started_at is not null then
      perform public._notify(p, 'prereq_reopened', jsonb_build_object(
        'task_id', v_task.id, 'title', v_task.title, 'prereq', new.title))
      from public._task_people(v_task.id) p;
    end if;
  end loop;
  return null;
end;
$$;

create trigger tasks_flow_notify
  after update of status on public.tasks
  for each row execute function public.tasks_flow_notify();

revoke execute on function public._task_people(uuid) from public, anon, authenticated;
