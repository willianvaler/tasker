-- Hábitos como seção própria (D68): cada conta ganha uma página de hábitos de sistema, dentro da
-- pasta (escondida) da Caixa de entrada, como a própria Caixa de entrada. A tela Hábitos cria nela.
-- O tipo do hábito (marcar, contador, bom/ruim) já pode vir na criação (create_tasks_batch).

alter table public.pages add column is_habits boolean not null default false;
create unique index pages_one_habits_per_folder on public.pages (folder_id) where is_habits;

-- Contas existentes
insert into public.pages (folder_id, name, icon, view_type, is_habits)
select f.id, 'Hábitos', '🔥', 'habits', true
from public.folders f
where f.is_inbox and not exists (select 1 from public.pages p where p.folder_id = f.id and p.is_habits);

-- Contas novas
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 50)
  );

  insert into public.folders (owner_id, name, icon, is_inbox)
  values (new.id, 'Caixa de entrada', '📥', true)
  returning id into v_folder_id;

  insert into public.pages (folder_id, name, icon, is_inbox)
  values (v_folder_id, 'Caixa de entrada', '📥', true);

  insert into public.pages (folder_id, name, icon, view_type, is_habits)
  values (v_folder_id, 'Hábitos', '🔥', 'habits', true);

  return new;
end;
$$;

-- A página de hábitos de sistema não se apaga, não sai da pasta nem deixa de ser de hábitos
drop policy "pages_delete" on public.pages;
create policy "pages_delete" on public.pages for delete to authenticated
  using (not is_inbox and not is_habits and public.is_folder_member(folder_id, 'editor'));

create function public.pages_system_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.is_habits and (new.folder_id <> old.folder_id or new.view_type <> 'habits') then
    raise exception 'A página de hábitos não pode ser movida nem mudar de tipo' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger pages_system_guard
  before update of folder_id, view_type on public.pages
  for each row execute function public.pages_system_guard();

-- Duplicar: não vale para as páginas de sistema; a cópia leva o tipo do hábito
create or replace function public.duplicate_page(p_page_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_new_id uuid := gen_random_uuid();
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if v_page.is_inbox or v_page.is_habits then
    raise exception 'Esta página não pode ser duplicada' using errcode = '22023';
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position)
  values (v_new_id, v_page.folder_id, coalesce(nullif(trim(p_name), ''), v_page.name || ' (cópia)'),
          v_page.icon, v_page.view_type, v_page.reset_cycle, v_page.position + 0.5);

  -- Mapa de ids antigos → novos, para ligar as subtarefas às mães copiadas
  -- (drop antes: a função pode rodar mais de uma vez na mesma transação)
  drop table if exists _dup_map;
  create temp table _dup_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;

  insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                            position, meta, habit_kind, habit_target, created_by)
  select m.new_id, v_new_id, null, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
         t.position, t.meta, t.habit_kind, t.habit_target, auth.uid()
  from public.tasks t join _dup_map m on m.old_id = t.id
  where t.parent_task_id is null;

  insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                            position, meta, created_by)
  select m.new_id, v_new_id, pm.new_id, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
         t.position, t.meta, auth.uid()
  from public.tasks t
  join _dup_map m on m.old_id = t.id
  join _dup_map pm on pm.old_id = t.parent_task_id;

  return v_new_id;
end;
$$;

-- Lote/captura: aceita o tipo do hábito ("habit_kind", "habit_target") em cada item
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
  if p_parent_id is not null and p_item ? 'children' and jsonb_array_length(p_item -> 'children') > 0 then
    raise exception 'Subtarefa não pode ter subtarefas' using errcode = '22023';
  end if;

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

revoke execute on function public.pages_system_guard() from public, anon, authenticated;
