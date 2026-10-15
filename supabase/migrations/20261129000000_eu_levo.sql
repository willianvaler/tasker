-- V3 §6 (M2): "eu levo". Em projeto, quem pode criar tarefas (o Colaborador também) se coloca como
-- responsável de uma tarefa que ainda não tem ninguém. Só a si mesmo e só sem responsável: quem
-- chega depois é recusado (a outra pessoa já levou). Atribuir outros continua pedindo task.assign.
create function public.task_unclaimed(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.task_assignees where task_id = p_task_id);
$$;
grant execute on function public.task_unclaimed(uuid) to authenticated;

create policy "task_assignees_claim" on public.task_assignees for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and pending_name is null
    and public.has_permission(folder_id, 'task.create')
    and public.task_unclaimed(task_id)
  );
