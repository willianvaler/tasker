-- Os guardas de permissão valem para quem chega pelo app (papel authenticated, também dentro das
-- RPCs security definer, que mudam o current_user mas não o papel da sessão). Manutenção do
-- superusuário e o cron passam direto. Só a ação de primeiro nível é checada: o que um trigger faz
-- em seguida (cascata de exclusão, tarefas que acompanham a página movida) já foi autorizado nela.

create or replace function public._app_caller()
returns uuid
language sql stable set search_path = ''
as $$
  select case when current_setting('role', true) in ('authenticated', 'anon') and pg_trigger_depth() <= 1
    then auth.uid() end;
$$;

create or replace function public.zz_tasks_permission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._app_caller();
  v_task public.tasks := case when tg_op = 'DELETE' then old else new end;
  v_assignee boolean;
  v_creator boolean;
begin
  if v_uid is null then
    return v_task;
  end if;
  -- Na edição vale quem criou antes da mudança (excluir a conta passa as tarefas para o dono)
  v_creator := case when tg_op = 'INSERT' then new.created_by else old.created_by end = v_uid;
  v_assignee := tg_op <> 'INSERT' and public.is_task_assignee(v_task.id, v_uid);

  if tg_op = 'INSERT' then
    if not public.has_permission(new.folder_id, 'task.create') then
      raise exception 'Seu cargo não cria tarefas aqui' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' then
    if not public.has_permission(old.folder_id, 'task.delete', v_assignee, v_creator) then
      raise exception 'Seu cargo não apaga esta tarefa' using errcode = '42501';
    end if;
  elsif not (
    public.has_permission(old.folder_id, 'task.edit')
    or public.has_permission(old.folder_id, 'task.complete', v_assignee, v_creator)
    or (v_creator and public.has_permission(old.folder_id, 'task.create'))
  ) then
    raise exception 'Seu cargo não altera esta tarefa' using errcode = '42501';
  end if;
  return v_task;
end;
$$;

create or replace function public.zz_pages_permission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages := case when tg_op = 'DELETE' then old else new end;
begin
  if public._app_caller() is null then
    return v_page;
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['manual_cycle', 'updated_at', 'updated_by', 'version'])
       = (to_jsonb(old) - array['manual_cycle', 'updated_at', 'updated_by', 'version']) then
    if not public.has_permission(old.folder_id, 'task.complete')
       and not public.has_permission(old.folder_id, 'task.complete', true) then
      raise exception 'Seu cargo não reinicia esta página' using errcode = '42501';
    end if;
    return new;
  end if;
  if not public.has_permission(v_page.folder_id, 'page.manage') then
    raise exception 'Seu cargo não muda páginas aqui' using errcode = '42501';
  end if;
  return v_page;
end;
$$;

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'task_completed', 'tasks_created', 'member_joined', 'comment_added', 'assignee_claimed',
  'boss_started', 'boss_defeated', 'project_team_changed'));
