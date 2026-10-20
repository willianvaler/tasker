-- ESCOPO_V10 §4 (CM1, D233): Comunidade. Quem publica manda uma CÓPIA da estrutura (formato dos
-- modelos, D46: páginas → tarefas → subtarefas, com plano de séries, recorrência, notas), sem
-- pessoas, responsáveis, datas, comentários, anexos, gastos nem histórico. Quem usa recebe uma pasta
-- nova pela mesma RPC dos modelos. Leitura para qualquer conta logada; escrita só por RPC.
-- Moderação (V10-5, padrão): 3 denúncias de pessoas diferentes ocultam a publicação.

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('project', 'workout', 'menu', 'list', 'habits')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text check (char_length(description) <= 500),
  icon text check (char_length(icon) <= 40),
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en', 'es')),
  data jsonb not null check (jsonb_typeof(data -> 'pages') = 'array' and pg_column_size(data) <= 512000),
  uses integer not null default 0,
  likes integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_posts_feed_idx on public.community_posts (hidden, created_at desc);
create index community_posts_author_idx on public.community_posts (author_id);

create table public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;
revoke insert, update, delete on public.community_posts, public.community_likes, public.community_reports
  from anon, authenticated;
create policy "community_posts_select" on public.community_posts for select to authenticated
  using (not hidden or author_id = (select auth.uid()));
create policy "community_likes_select" on public.community_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "community_reports_select" on public.community_reports for select to authenticated
  using (user_id = (select auth.uid()));

-- Cópia de uma tarefa com as subtarefas (até 6 níveis), no formato do create_tasks_batch
create function public._snapshot_task(p_task public.tasks, p_level integer default 1)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', p_task.title,
    'notes', p_task.notes,
    'priority', nullif(p_task.priority, 0),
    'labels', case when cardinality(p_task.labels) > 0 then to_jsonb(p_task.labels) end,
    'recurrence', p_task.recurrence,
    'meta', p_task.meta,
    'repeat_plan', p_task.repeat_plan,
    'habit_kind', nullif(p_task.habit_kind, 'check'),
    'habit_target', p_task.habit_target,
    'children', case when p_level < 6 then (
      select jsonb_agg(public._snapshot_task(c, p_level + 1) order by c.position)
      from public.tasks c where c.parent_task_id = p_task.id) end
  ));
$$;

create function public._snapshot_page(p_page public.pages)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p_page.name, 'icon', p_page.icon, 'view_type', p_page.view_type, 'reset_cycle', p_page.reset_cycle,
    'items', coalesce((select jsonb_agg(public._snapshot_task(t) order by t.position)
                       from public.tasks t where t.page_id = p_page.id and t.parent_task_id is null), '[]'));
$$;

/**
 * Publicar: uma pasta (com as subpastas), uma página ou um modelo salvo. Quem publica tem de ver o
 * que publica; página de gastos não entra (é dado, não estrutura). No máximo 20 por dia.
 */
create function public.community_publish(
  p_kind text,
  p_title text,
  p_description text default null,
  p_icon text default null,
  p_folder_id uuid default null,
  p_page_id uuid default null,
  p_template_id uuid default null,
  p_locale text default 'pt-BR'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_data jsonb;
  v_id uuid;
  v_page public.pages;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if (p_folder_id is not null)::int + (p_page_id is not null)::int + (p_template_id is not null)::int <> 1 then
    raise exception 'Escolha uma pasta, uma página ou um modelo' using errcode = '22023';
  end if;
  if (select count(*) from public.community_posts
      where author_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'No máximo 20 publicações por dia' using errcode = '22023';
  end if;

  if p_folder_id is not null then
    if not public.is_folder_member(p_folder_id) then
      raise exception 'Pasta não encontrada' using errcode = 'P0002';
    end if;
    select jsonb_build_object('pages', coalesce(jsonb_agg(public._snapshot_page(p) order by f.depth, p.position), '[]'))
    into v_data
    from (select id, 0 as depth from public.folders where id = p_folder_id
          union all select id, 1 from public.folders where parent_id = p_folder_id) f
    join public.pages p on p.folder_id = f.id
    where p.view_type <> 'expenses' and not p.is_inbox and not p.is_habits;
  elsif p_page_id is not null then
    select * into v_page from public.pages where id = p_page_id;
    if v_page.id is null or not public.is_folder_member(v_page.folder_id) then
      raise exception 'Página não encontrada' using errcode = 'P0002';
    end if;
    if v_page.view_type = 'expenses' then
      raise exception 'Página de gastos não se publica' using errcode = '22023';
    end if;
    v_data := jsonb_build_object('pages', jsonb_build_array(public._snapshot_page(v_page)));
  else
    select data into v_data from public.user_templates where id = p_template_id and owner_id = auth.uid();
    if v_data is null then
      raise exception 'Modelo não encontrado' using errcode = 'P0002';
    end if;
  end if;
  if jsonb_array_length(v_data -> 'pages') = 0 or jsonb_array_length(v_data -> 'pages') > 30 then
    raise exception 'Precisa ter de 1 a 30 páginas' using errcode = '22023';
  end if;

  insert into public.community_posts (kind, title, description, icon, locale, data)
  values (p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_icon, '')), ''),
          case when p_locale in ('pt-BR', 'en', 'es') then p_locale else 'pt-BR' end, v_data)
  returning id into v_id;
  return v_id;
end;
$$;

/** Mudar o texto (só o autor). */
create function public.community_update(p_id uuid, p_title text, p_description text, p_kind text, p_icon text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_posts
  set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), ''), kind = p_kind,
      icon = nullif(trim(coalesce(p_icon, '')), ''), updated_at = now()
  where id = p_id and author_id = auth.uid();
  if not found then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

/** Despublicar (só o autor): some para todos; quem já usou continua com a cópia. */
create function public.community_unpublish(p_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.community_posts where id = p_id and author_id = auth.uid();
$$;

/** Usar: cria uma pasta pessoal com a cópia e conta um uso. Devolve o id da pasta. */
create function public.community_use(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_post public.community_posts;
  v_folder uuid;
begin
  select * into v_post from public.community_posts where id = p_id and (not hidden or author_id = auth.uid());
  if v_post.id is null then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;
  v_folder := public.create_from_template(v_post.title, v_post.icon, v_post.data, false);
  update public.community_posts set uses = uses + 1 where id = p_id and author_id <> auth.uid();
  return v_folder;
end;
$$;

/** Curtir ou tirar a curtida; devolve o total. */
create function public.community_like(p_id uuid, p_on boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_likes integer;
begin
  if not exists (select 1 from public.community_posts where id = p_id and not hidden) then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.community_likes (post_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
  else
    delete from public.community_likes where post_id = p_id and user_id = auth.uid();
  end if;
  update public.community_posts set likes = (select count(*) from public.community_likes where post_id = p_id)
  where id = p_id returning likes into v_likes;
  return v_likes;
end;
$$;

/** Denunciar (uma vez por pessoa). Com 3 pessoas diferentes, oculta até alguém revisar. */
create function public.community_report(p_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.community_posts where id = p_id and author_id <> auth.uid()) then
    raise exception 'Publicação não encontrada' using errcode = 'P0002';
  end if;
  insert into public.community_reports (post_id, user_id, reason)
  values (p_id, auth.uid(), left(nullif(trim(coalesce(p_reason, '')), ''), 500))
  on conflict do nothing;
  update public.community_posts set hidden = true
  where id = p_id and (select count(*) from public.community_reports where post_id = p_id) >= 3;
end;
$$;

/**
 * Lista da aba Comunidade: busca no título e na descrição, filtro por tipo e idioma, por mais
 * usados ou mais novos. Sem a cópia (vem no community_post); com o autor (nome e nick).
 */
create function public.community_feed(
  p_query text default null, p_kind text default null, p_locale text default null,
  p_order text default 'popular', p_limit integer default 30, p_offset integer default 0, p_mine boolean default false
)
returns table (id uuid, kind text, title text, description text, icon text, locale text, uses integer,
               likes integer, liked boolean, mine boolean, author_name text, author_username text,
               pages integer, items integer, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.kind, c.title, c.description, c.icon, c.locale, c.uses, c.likes,
         exists (select 1 from public.community_likes l where l.post_id = c.id and l.user_id = auth.uid()),
         c.author_id = auth.uid(), p.display_name, p.username,
         jsonb_array_length(c.data -> 'pages'),
         (select coalesce(sum(jsonb_array_length(coalesce(pg -> 'items', '[]'))), 0)::int
          from jsonb_array_elements(c.data -> 'pages') pg),
         c.created_at
  from public.community_posts c join public.profiles p on p.id = c.author_id
  where auth.uid() is not null
    and (not c.hidden or c.author_id = auth.uid())
    and (not p_mine or c.author_id = auth.uid())
    and (p_kind is null or c.kind = p_kind)
    and (p_locale is null or c.locale = p_locale)
    and (nullif(trim(coalesce(p_query, '')), '') is null
         or c.title ilike '%' || trim(p_query) || '%' or c.description ilike '%' || trim(p_query) || '%')
  order by case when p_order = 'new' then null else c.uses + c.likes * 2 end desc nulls last, c.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

/** Uma publicação com a cópia (para a prévia antes de usar). */
create function public.community_post(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(c) - 'author_id' || jsonb_build_object(
    'author_name', p.display_name, 'author_username', p.username, 'mine', c.author_id = auth.uid(),
    'liked', exists (select 1 from public.community_likes l where l.post_id = c.id and l.user_id = auth.uid()))
  from public.community_posts c join public.profiles p on p.id = c.author_id
  where c.id = p_id and auth.uid() is not null and (not c.hidden or c.author_id = auth.uid());
$$;

revoke execute on function public._snapshot_task(public.tasks, integer), public._snapshot_page(public.pages)
  from public, anon, authenticated;
revoke execute on function public.community_publish(text, text, text, text, uuid, uuid, uuid, text),
  public.community_update(uuid, text, text, text, text), public.community_unpublish(uuid),
  public.community_use(uuid), public.community_like(uuid, boolean), public.community_report(uuid, text),
  public.community_feed(text, text, text, text, integer, integer, boolean), public.community_post(uuid)
  from public, anon;
grant execute on function public.community_publish(text, text, text, text, uuid, uuid, uuid, text),
  public.community_update(uuid, text, text, text, text), public.community_unpublish(uuid),
  public.community_use(uuid), public.community_like(uuid, boolean), public.community_report(uuid, text),
  public.community_feed(text, text, text, text, integer, integer, boolean), public.community_post(uuid)
  to authenticated;

-- A criação em lote passa a gravar as notas (a cópia da comunidade as leva)
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
    notes
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
    left(nullif(p_item ->> 'notes', ''), 10000)
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

-- Exportar meus dados (LGPD): publicações, curtidas e denúncias
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
