-- Fase 6: kanban (A fazer / Fazendo / Feito). O status só muda por função do servidor (D7):
-- ir para Feito é concluir (complete_task, com XP e bosses) e sair de Feito é desfazer
-- (uncomplete_task). Entre A fazer e Fazendo só troca o status.

create function public.set_task_status(p_task_id uuid, p_status public.task_status)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_result jsonb := '{}';
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.status = p_status then
    return jsonb_build_object('task', to_jsonb(v_task));
  end if;

  if p_status = 'done' then
    return public.complete_task(p_task_id);
  end if;
  if v_task.status = 'done' then
    v_result := public.uncomplete_task(p_task_id);
  end if;
  update public.tasks set status = p_status where id = p_task_id returning * into v_task;
  return v_result || jsonb_build_object('task', to_jsonb(v_task));
end;
$$;

revoke execute on function public.set_task_status(uuid, public.task_status) from public, anon;
grant execute on function public.set_task_status(uuid, public.task_status) to authenticated;
