-- V3 §4.1 (J1): tarefa com repetições. O plano (`tasks.repeat_plan`) diz quantas séries ou vezes
-- a tarefa pede; o andamento é de cada pessoa (`task_progress`). Cada "feita" soma uma; a tarefa
-- só conclui (com XP, pelo complete_task de sempre) quando a conta chega ao total. Desfazer a
-- última volta a conta e, se ela tinha concluído, reabre a tarefa (o XP sai junto).
--
-- Andamento que vale: tarefa concluída mostra total/total; aberta, no máximo total − 1 (quem
-- desmarca pela caixinha volta ao que tinha antes). Em página com reinício, a conta é do ciclo.

-- Formato: {mode, total, rest_seconds?, rest_after_seconds?, duration_seconds?, interval_minutes?}
create function public.valid_repeat_plan(p jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and p ->> 'mode' in ('sets', 'count', 'interval', 'timed')
    and jsonb_typeof(p -> 'total') = 'number'
    and (p ->> 'total')::numeric between 1 and 99
    and (p ->> 'total')::numeric = trunc((p ->> 'total')::numeric)
    and (not p ? 'rest_seconds' or jsonb_typeof(p -> 'rest_seconds') = 'null'
         or (jsonb_typeof(p -> 'rest_seconds') = 'number' and (p ->> 'rest_seconds')::numeric between 0 and 3600))
    and (not p ? 'rest_after_seconds' or jsonb_typeof(p -> 'rest_after_seconds') = 'null'
         or (jsonb_typeof(p -> 'rest_after_seconds') = 'number' and (p ->> 'rest_after_seconds')::numeric between 0 and 3600))
    and (not p ? 'duration_seconds' or jsonb_typeof(p -> 'duration_seconds') = 'null'
         or (jsonb_typeof(p -> 'duration_seconds') = 'number' and (p ->> 'duration_seconds')::numeric between 1 and 3600))
    and (not p ? 'interval_minutes' or jsonb_typeof(p -> 'interval_minutes') = 'null'
         or (jsonb_typeof(p -> 'interval_minutes') = 'number' and (p ->> 'interval_minutes')::numeric between 1 and 1440))
  )
$$;

alter table public.tasks add column repeat_plan jsonb
  constraint tasks_repeat_plan_valid check (public.valid_repeat_plan(repeat_plan));

grant insert (repeat_plan), update (repeat_plan) on public.tasks to authenticated;

-- Andamento por pessoa. Só a RPC grava; o aparelho recebe as próprias linhas pelo sync.
create table public.task_progress (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  done_reps integer not null default 0 check (done_reps between 0 and 99),
  -- Valores de cada série (carga, reps, RPE...), na ordem; a última sai ao desfazer
  logged_values jsonb not null default '[]' check (jsonb_typeof(logged_values) = 'array'),
  -- Ciclo da página quando a conta foi feita ('once' sem reinício); outro ciclo zera
  cycle_key text not null default 'once',
  updated_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_progress_user on public.task_progress (user_id);

alter table public.task_progress enable row level security;
create policy "task_progress: a própria" on public.task_progress
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.task_progress from anon, authenticated;

alter publication powersync add table public.task_progress;

-- Uma série feita (+1) ou desfeita (−1). Devolve {done_reps, total, completed} e, quando conclui,
-- o resumo do complete_task (XP, nível, boss).
create function public.log_rep(p_task_id uuid, p_delta integer, p_values jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page public.pages;
  v_total integer;
  v_key text;
  v_progress public.task_progress;
  v_current integer;
  v_new integer;
  v_values jsonb;
  v_result jsonb := '{}';
  v_waiting uuid[];
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_task.folder_id, 'task.complete',
                               public.is_task_assignee(v_task.id, auth.uid()), v_task.created_by = auth.uid()) then
    raise exception 'Seu cargo não conclui esta tarefa' using errcode = '42501';
  end if;
  if v_task.repeat_plan is null then
    raise exception 'Esta tarefa não tem repetições' using errcode = '22023';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  v_total := (v_task.repeat_plan ->> 'total')::integer;

  select * into v_page from public.pages where id = v_task.page_id;
  v_key := public.cycle_key_for(
    public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence),
    public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  if v_key is null or v_key like 'r:%' then
    v_key := 'once';
  end if;

  select * into v_progress from public.task_progress where task_id = p_task_id and user_id = auth.uid();
  if v_progress.cycle_key is distinct from v_key then
    v_progress.done_reps := 0;
    v_progress.logged_values := '[]';
  end if;
  v_current := case when v_task.status = 'done' then v_total
                    else least(coalesce(v_progress.done_reps, 0), v_total - 1) end;
  v_values := coalesce(v_progress.logged_values, '[]');

  if p_delta = 1 then
    if v_task.status = 'done' then
      return jsonb_build_object('done_reps', v_total, 'total', v_total, 'completed', true);
    end if;
    -- Tarefa bloqueada não começa (a mesma regra do guarda de iniciar/concluir)
    if v_current = 0 and current_setting('app.force_unblock', true) is distinct from v_task.id::text then
      v_waiting := public.task_blockers(v_task.id);
      if cardinality(v_waiting) > 0 then
        raise exception 'Tarefa bloqueada. Aguardando: %',
          (select string_agg(title, ', ') from public.tasks where id = any (v_waiting))
          using errcode = '22023';
      end if;
      if cardinality(public.page_blockers(v_task.page_id)) > 0 then
        raise exception 'Lista bloqueada' using errcode = '22023';
      end if;
    end if;
    v_new := v_current + 1;
    v_values := v_values || jsonb_build_array(coalesce(p_values, '{}'));
    if v_new >= v_total then
      v_result := public.complete_task(p_task_id);
      -- Recorrente comum: concluir avança a data e a tarefa segue aberta, com a conta zerada
      if (select status from public.tasks where id = p_task_id) <> 'done' then
        v_new := 0;
        v_values := '[]';
      end if;
    end if;
  else
    if v_task.status = 'done' then
      v_result := public.uncomplete_task(p_task_id);
      v_new := v_total - 1;
    else
      v_new := greatest(v_current - 1, 0);
    end if;
    if jsonb_array_length(v_values) > 0 then
      v_values := v_values - (jsonb_array_length(v_values) - 1);
    end if;
  end if;

  insert into public.task_progress (task_id, user_id, done_reps, logged_values, cycle_key, updated_at)
  values (p_task_id, auth.uid(), v_new, v_values, v_key, now())
  on conflict (task_id, user_id) do update
  set done_reps = excluded.done_reps, logged_values = excluded.logged_values,
      cycle_key = excluded.cycle_key, updated_at = excluded.updated_at;

  return coalesce(v_result, '{}') || jsonb_build_object(
    'done_reps', case when (select status from public.tasks where id = p_task_id) = 'done' then v_total else v_new end,
    'total', v_total,
    'completed', (select status from public.tasks where id = p_task_id) = 'done');
end;
$$;

revoke execute on function public.log_rep(uuid, integer, jsonb) from public, anon;
grant execute on function public.log_rep(uuid, integer, jsonb) to authenticated;

-- O lote e a captura mandam o plano junto
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
    habit_kind, habit_target, created_by, status, completed_by, completed_at, done_cycle_key, repeat_plan
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
    v_key,
    case when jsonb_typeof(p_item -> 'repeat_plan') = 'object' then p_item -> 'repeat_plan' end
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

-- Virada de ciclo também zera a conta das séries
create or replace function public.refresh_cycles(p_page_id uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    select t.id
    from public.tasks t
    join public.pages p on p.id = t.page_id
    where t.status = 'done'
      and t.done_cycle_key is not null
      and t.done_cycle_key <> 'once'
      and (p_page_id is null or p.id = p_page_id)
      and (auth.uid() is null or public.is_folder_member(p.folder_id))
      and t.done_cycle_key <> public.cycle_key_for(
        public.task_cycle_kind(p.view_type, p.reset_cycle, t.recurrence),
        public.folder_timezone(p.folder_id), now(), p.manual_cycle
      )
  )
  update public.tasks t
  set status = 'todo', completed_by = null, completed_at = null, done_cycle_key = null
  from stale
  where t.id = stale.id;
  get diagnostics v_count = row_count;

  update public.tasks t
  set count_up = 0, count_down = 0, count_key = null
  from public.pages p
  where p.id = t.page_id and t.count_key is not null
    and (p_page_id is null or p.id = p_page_id)
    and (auth.uid() is null or public.is_folder_member(p.folder_id))
    and t.count_key <> public.habit_count_key(t, p);

  delete from public.task_progress tp
  using public.tasks t, public.pages p
  where t.id = tp.task_id and p.id = t.page_id and tp.cycle_key <> 'once'
    and (p_page_id is null or p.id = p_page_id)
    and (auth.uid() is null or public.is_folder_member(p.folder_id))
    and tp.cycle_key <> public.cycle_key_for(
      public.task_cycle_kind(p.view_type, p.reset_cycle, t.recurrence),
      public.folder_timezone(p.folder_id), now(), p.manual_cycle);
  return v_count;
end;
$$;

-- Séries também pela fila do aparelho (offline)
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
    when 'log_rep' then
      return public.log_rep((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                            p_args -> 'p_values');
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;

-- Duplicar página leva o plano de repetição (o andamento, não)
create or replace function public.duplicate_page(p_page_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_new_id uuid := gen_random_uuid();
  v_level integer;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if v_page.is_inbox or v_page.is_habits then
    raise exception 'Esta página não pode ser duplicada' using errcode = '22023';
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position, max_depth)
  values (v_new_id, v_page.folder_id, coalesce(nullif(trim(p_name), ''), v_page.name || ' (cópia)'),
          v_page.icon, v_page.view_type, v_page.reset_cycle, v_page.position + 0.5, v_page.max_depth);

  drop table if exists _dup_map;
  create temp table _dup_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;

  for v_level in 1 .. (public.tree_limits() ->> 'hard_max_depth')::int loop
    insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                              position, meta, habit_kind, habit_target, created_by, repeat_plan)
    select m.new_id, v_new_id, pm.new_id, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
           t.position, t.meta, t.habit_kind, t.habit_target, auth.uid(), t.repeat_plan
    from public.tasks t
    join _dup_map m on m.old_id = t.id
    left join _dup_map pm on pm.old_id = t.parent_task_id
    where t.page_id = p_page_id and t.depth = v_level;
  end loop;

  return v_new_id;
end;
$$;
