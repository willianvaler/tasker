-- ESCOPO_V6 §2 (AC3.6/AC3.8, D235): biblioteca de exercícios.
-- `exercises`: catálogo global, só leitura (carga em migração gerada por
-- scripts/exercicios/gerar-migracao.mjs a partir de data/exercicios/). `user_exercises`: os
-- exercícios próprios, da pessoa ou de um projeto/grupo. `tasks.exercise_id` liga o item ao
-- exercício (id do catálogo, ex.: "mit-0025", ou o uuid de um próprio). Os dois vão para o
-- aparelho pelo PowerSync (a biblioteca funciona sem internet).

create table public.exercises (
  id text primary key check (char_length(id) <= 80),
  name_en text not null,
  name_pt text,
  name_es text,
  body_part text not null,
  target text,
  secondary text[] not null default '{}',
  equipment text not null,
  kind text not null default 'reps' check (kind in ('reps', 'time', 'cardio')),
  level text,
  mechanic text,
  force text,
  instructions jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.exercises enable row level security;
revoke insert, update, delete on public.exercises from anon, authenticated;
create policy "exercises_select" on public.exercises for select to authenticated using (true);

create table public.user_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Do projeto/grupo (todos do projeto veem e usam); nulo = só da pessoa
  folder_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  body_part text not null default 'other',
  target text,
  equipment text not null default 'other',
  kind text not null default 'reps' check (kind in ('reps', 'time', 'cardio')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_exercises_owner_idx on public.user_exercises (owner_id);
create index user_exercises_folder_idx on public.user_exercises (folder_id) where folder_id is not null;
alter table public.user_exercises enable row level security;
revoke insert, update on public.user_exercises from anon, authenticated;
grant insert (id, folder_id, name, body_part, target, equipment, kind, notes),
      update (name, body_part, target, equipment, kind, notes) on public.user_exercises to authenticated;
create policy "user_exercises_select" on public.user_exercises for select to authenticated
  using (owner_id = (select auth.uid()) or (folder_id is not null and public.is_folder_member(folder_id)));
create policy "user_exercises_insert" on public.user_exercises for insert to authenticated
  with check (owner_id = (select auth.uid())
              and (folder_id is null or public.has_permission(folder_id, 'task.create')));
create policy "user_exercises_update" on public.user_exercises for update to authenticated
  using (owner_id = (select auth.uid()));
create policy "user_exercises_delete" on public.user_exercises for delete to authenticated
  using (owner_id = (select auth.uid()));

-- A pasta do exercício próprio é sempre a raiz (participação mora na raiz)
create function public.user_exercises_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.folder_id is not null then
    new.folder_id := public.folder_root(new.folder_id);
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger user_exercises_fill before insert or update on public.user_exercises
  for each row execute function public.user_exercises_fill();

alter table public.tasks add column exercise_id text check (char_length(exercise_id) <= 80);
grant insert (exercise_id), update (exercise_id) on public.tasks to authenticated;

alter publication powersync add table public.exercises, public.user_exercises;
alter publication supabase_realtime add table public.user_exercises;

-- A criação em lote aceita o exercício ligado
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
    notes, exercise_id
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
    left(nullif(p_item ->> 'exercise_id', ''), 80)
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

-- Exportar meus dados (LGPD): os exercícios próprios
create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    -- V10: amigos (nick e desde quando) e o link de amizade
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', f.username, 'status', f.status, 'since', f.since))
                         from public.my_friends() f), '[]'),
    -- V10 §4: o que publiquei na comunidade (com a cópia), curtidas e denúncias
    'community_posts', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
                                 from public.community_posts c where c.author_id = v_user), '[]'),
    'community_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'at', l.created_at))
                                 from public.community_likes l where l.user_id = v_user), '[]'),
    'community_reports', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id')
                                   from public.community_reports r where r.user_id = v_user), '[]'),
    -- V6: exercícios próprios
    'user_exercises', coalesce((select jsonb_agg(to_jsonb(u) - 'owner_id' order by u.created_at)
                                from public.user_exercises u where u.owner_id = v_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;

-- Política de privacidade com o nick e os amigos (dado novo): todo mundo aceita de novo (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-20' $$;
