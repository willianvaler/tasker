-- V3 §2.8 (M7): tarefa de aprovação. Só a pessoa (approver_id) ou o cargo definido
-- (approver_role: 'manager' = Gerente ou Dono; 'owner' = só o Dono) conclui ou reabre. O guarda é
-- no status, então vale para todo caminho (caixinha, kanban, fila offline, automação).
alter table public.tasks
  add column approver_id uuid references public.profiles (id) on delete set null,
  add column approver_role text check (approver_role in ('manager', 'owner'));
grant insert (approver_id, approver_role), update (approver_id, approver_role) on public.tasks to authenticated;

create function public.can_approve(p_task public.tasks, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_task.approver_id is null and p_task.approver_role is null then true
    when p_task.approver_id = p_user then true
    when p_task.approver_role is not null then exists (
      select 1 from public.folder_members m
      where m.folder_id = public.folder_root(p_task.folder_id) and m.user_id = p_user
        and (m.role = 'owner' or (p_task.approver_role = 'manager' and m.role = 'manager')))
      or (select owner_id from public.folders where id = public.folder_root(p_task.folder_id)) = p_user
    else false
  end;
$$;

create function public.tasks_approval_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public._app_caller() is null or old.status is not distinct from new.status then
    return new;
  end if;
  if (old.status = 'done' or new.status = 'done') and not public.can_approve(new, public._app_caller()) then
    raise exception 'Esta tarefa é uma aprovação: só % aprova',
      coalesce((select display_name from public.profiles where id = new.approver_id),
               case new.approver_role when 'owner' then 'o Dono' else 'quem gerencia o projeto' end)
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_approval_guard before update of status on public.tasks
  for each row execute function public.tasks_approval_guard();
