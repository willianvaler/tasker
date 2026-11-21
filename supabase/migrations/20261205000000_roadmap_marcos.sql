-- GP3 (D315, ESCOPO_V12 §5): roadmap por marco. A tarefa pode ser ligada a um marco do projeto
-- (`tasks.milestone_id`, no sync); a tela Roadmap mostra os marcos por data com as tarefas, o
-- progresso, o que atrasou e o que está bloqueado. Marco de outro projeto não vale: escolher dá erro;
-- mover a tarefa para outro projeto solta o marco.

alter table public.tasks add column milestone_id uuid references public.milestones (id) on delete set null;
create index tasks_milestone on public.tasks (milestone_id) where milestone_id is not null;
grant insert (milestone_id), update (milestone_id) on public.tasks to authenticated;

create function public.tasks_milestone_fit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.milestone_id is null then
    return new;
  end if;
  if exists (select 1 from public.milestones m
             where m.id = new.milestone_id and m.folder_id = public.folder_root(new.folder_id)) then
    return new;
  end if;
  -- Escolheu um marco de fora: recusa. A tarefa mudou de projeto: solta o marco.
  if tg_op = 'INSERT' or new.milestone_id is distinct from old.milestone_id then
    raise exception 'O marco precisa ser do mesmo projeto' using errcode = '22023';
  end if;
  new.milestone_id := null;
  return new;
end;
$$;
-- Depois do trigger que preenche o folder_id (os nomes "tasks_before_write" < "tasks_milestone_fit")
create trigger tasks_milestone_fit before insert or update of milestone_id, folder_id, page_id on public.tasks
  for each row execute function public.tasks_milestone_fit();

-- Lote e escrita rápida: aceitam o marco
CREATE OR REPLACE FUNCTION public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_kind text;
  v_key text;
  v_completion uuid;
  v_page public.pages;
  v_task public.tasks;
  v_recurrence jsonb := case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end;
  v_habit_kind text := coalesce(p_item ->> 'habit_kind', 'check');
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_done then
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_recurrence);
    v_key := public.cycle_key_for(v_kind, public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, due_time, remind_before, labels, recurrence, meta, position,
    habit_kind, habit_target, created_by, status, completed_by, completed_at, done_cycle_key, repeat_plan, visibility,
    notes, exercise_id, progression, habit_sides, milestone_id
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    -- Horário e lembrete (D206): só com data
    case when p_item ->> 'due_date' is not null then (p_item ->> 'due_time')::time end,
    case when p_item ->> 'due_date' is not null and p_item ->> 'due_time' is not null
         then (p_item ->> 'remind_before')::integer end,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    v_recurrence,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    v_habit_kind,
    case when v_habit_kind = 'counter' then coalesce((p_item ->> 'habit_target')::smallint, 1) end,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key,
    case when jsonb_typeof(p_item -> 'repeat_plan') = 'object' then p_item -> 'repeat_plan' end,
    -- Visibilidade (V10 §2): +publica / +amigos na escrita rápida; o resto é privada
    case when p_item ->> 'visibility' in ('friends', 'public') then p_item ->> 'visibility' else 'private' end,
    -- Notas (V10 §4): a cópia da comunidade leva os ingredientes do cardápio, o modo de fazer...
    left(nullif(p_item ->> 'notes', ''), 10000),
    -- Exercício da biblioteca (AC3.8): id do catálogo ou de um exercício próprio
    left(nullif(p_item ->> 'exercise_id', ''), 80),
    case when p_item ->> 'progression' in ('off', 'linear', 'double', 'greyskull', 'time')
         then p_item ->> 'progression' end,
    -- Lado do hábito bom/ruim (PC1, importar do Habitica): só "bom" ou só "ruim"; o resto, os dois
    case when v_habit_kind = 'plusminus' and p_item ->> 'habit_sides' in ('up', 'down')
         then p_item ->> 'habit_sides' else 'both' end,
    -- Marco (GP3): "~Marco" na escrita rápida; o trigger confere que é do mesmo projeto
    (nullif(p_item ->> 'milestone_id', ''))::uuid
  )
  returning * into v_task;
  v_id := v_task.id;

  -- Responsáveis: o trigger confere que o user_id é membro; nome pendente é livre
  insert into public.task_assignees (task_id, user_id, pending_name)
  select v_id, (a ->> 'user_id')::uuid, case when a ? 'user_id' then null else a ->> 'pending_name' end
  from jsonb_array_elements(case when jsonb_typeof(p_item -> 'assignees') = 'array' then p_item -> 'assignees' else '[]' end) a
  on conflict do nothing;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_id, v_task.folder_id, auth.uid(), v_key)
    returning id into v_completion;
    perform public._award_completion(v_task, v_page, v_completion, v_kind, true);
    perform public._refresh_profile_stats(auth.uid());
  end if;
  return v_id;
end;
$function$;
