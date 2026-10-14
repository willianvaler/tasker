-- V3 §1.1 (G6): o lote cria a árvore inteira (recuo em vários níveis). O aparelho achata o que
-- passaria do limite antes de mandar; o servidor confere de novo nos triggers da árvore.

create or replace function public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns uuid
language plpgsql security definer set search_path = ''
as $$
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
    id, page_id, parent_task_id, title, priority, due_date, labels, recurrence, meta, position,
    habit_kind, habit_target, created_by, status, completed_by, completed_at, done_cycle_key
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
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
    v_key
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
$$;


-- Um item e, recursivamente, as subtarefas dele. Devolve os ids criados, na ordem.
create function public._insert_batch_branch(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns setof uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_child jsonb;
  v_position double precision := 0;
begin
  v_id := public._insert_batch_task(p_page_id, p_parent_id, p_item, p_position);
  return next v_id;
  for v_child in select * from jsonb_array_elements(coalesce(p_item -> 'children', '[]')) loop
    v_position := v_position + 1;
    return query select * from public._insert_batch_branch(p_page_id, v_id, v_child, v_position);
  end loop;
end;
$$;

create or replace function public.create_tasks_batch(p_page_id uuid, p_items jsonb)
returns setof public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid;
  v_position double precision;
  v_total integer := 0;
  v_item jsonb;
  v_ids uuid[];
begin
  select p.folder_id into v_folder_id from public.pages p where p.id = p_page_id;
  if v_folder_id is null or not public.is_folder_member(v_folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhuma tarefa para criar' using errcode = '22023';
  end if;

  -- Todos os itens, em qualquer nível
  with recursive todos(item, nivel) as (
    select i, 1 from jsonb_array_elements(p_items) i
    union all
    select c, t.nivel + 1 from todos t, jsonb_array_elements(coalesce(t.item -> 'children', '[]')) c
    where t.nivel < 10
  )
  select count(*) into v_total from todos;
  if v_total > 500 then
    raise exception 'No máximo 500 tarefas por vez' using errcode = '22023';
  end if;

  select coalesce(max(t.position), 0) into v_position
  from public.tasks t where t.page_id = p_page_id and t.parent_task_id is null;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    -- Em variável: chamada direta no where rodaria a função uma vez por linha da tabela
    v_ids := array(select public._insert_batch_branch(p_page_id, null, v_item, v_position));
    return query select t.* from unnest(v_ids) with ordinality u(id, n) join public.tasks t on t.id = u.id order by u.n;
  end loop;

  perform public._log_activity(v_folder_id, 'tasks_created', jsonb_build_object(
    'count', jsonb_array_length(p_items), 'page_id', p_page_id,
    'title', case when jsonb_array_length(p_items) = 1 then trim(p_items -> 0 ->> 'title') end));
end;
$$;

revoke execute on function public._insert_batch_branch(uuid, uuid, jsonb, double precision) from public, anon, authenticated;

-- Página e projeto podem nascer com limite próprio
grant insert (max_depth) on public.pages to authenticated;
grant insert (max_depth) on public.folders to authenticated;
