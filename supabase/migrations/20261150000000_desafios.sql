-- V6 §15.5 (AC10.4, D184): modo competição do grupo. O grupo é um projeto (pasta raiz) ou um
-- time. Desafio com duração em dias; o ranking conta dias de treino. Um dia de treino nasce no
-- servidor quando a pessoa conclui uma página de treino (todas as tarefas da página feitas) ou fica
-- 30 min ou mais numa sessão do Modo Treino. Mural (check-in com foto) e chat do grupo, com reações.

-- ============================================================
-- Dias de treino (de cada pessoa; os outros só veem pelo ranking)
-- ============================================================
create table public.workout_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  -- 'page': página de treino concluída · 'session': 30 min ou mais no Modo Treino
  source text not null check (source in ('page', 'session')),
  page_id uuid references public.pages (id) on delete set null,
  minutes integer,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.workout_days enable row level security;
revoke insert, update, delete on public.workout_days from anon, authenticated;
create policy "workout_days_select" on public.workout_days for select to authenticated
  using (user_id = (select auth.uid()));

create function public._record_workout_day(p_user uuid, p_source text, p_page uuid, p_minutes integer)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.workout_days (user_id, day, source, page_id, minutes)
  values (p_user, (now() at time zone coalesce(
            (select timezone from public.profiles where id = p_user), 'America/Sao_Paulo'))::date,
          p_source, p_page, p_minutes)
  on conflict (user_id, day) do update
  set minutes = greatest(public.workout_days.minutes, excluded.minutes);
$$;

-- Página de treino: de cards ou da pasta Academia
create function public._is_workout_page(p_page_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.pages p join public.folders f on f.id = p.folder_id
                 left join public.folders r on r.id = f.parent_id
                 where p.id = p_page_id and (p.view_type = 'cards' or f.is_gym or coalesce(r.is_gym, false)));
$$;

-- Todas as tarefas (folhas) da página feitas
create function public._page_all_done(p_page_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.tasks t where t.page_id = p_page_id)
     and not exists (
       select 1 from public.tasks t
       where t.page_id = p_page_id and t.status <> 'done'
         and not exists (select 1 from public.tasks c where c.parent_task_id = t.id));
$$;

create function public.tasks_workout_day()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.completed_by is not null
     and public._is_workout_page(new.page_id) and public._page_all_done(new.page_id) then
    perform public._record_workout_day(new.completed_by, 'page', new.page_id, null);
  end if;
  return new;
end;
$$;
create trigger tasks_workout_day
  after update of status on public.tasks
  for each row execute function public.tasks_workout_day();

-- Sair da sessão: 30 min ou mais (desde que entrou), ou a página toda feita, conta o dia
create or replace function public.leave_workout_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.workout_sessions;
  v_member public.workout_session_members;
  v_minutes integer;
begin
  select * into v_session from public.workout_sessions where id = p_session_id;
  select * into v_member from public.workout_session_members
  where session_id = p_session_id and user_id = auth.uid();
  if v_member.status = 'joined' and v_session.ended_at is null then
    v_minutes := floor(extract(epoch from now() - coalesce(v_member.joined_at, v_session.started_at)) / 60);
    if v_minutes >= 30 or public._page_all_done(v_session.page_id) then
      perform public._record_workout_day(auth.uid(), 'session', v_session.page_id, least(v_minutes, 720));
    end if;
  end if;

  update public.workout_session_members set status = 'left', left_at = now()
  where session_id = p_session_id and user_id = auth.uid() and status <> 'left';
  update public.workout_sessions s set ended_at = now(), updated_at = now()
  where s.id = p_session_id and s.ended_at is null
    and not exists (select 1 from public.workout_session_members m
                    where m.session_id = s.id and m.status = 'joined');
end;
$$;

-- ============================================================
-- Grupo: projeto (pasta raiz) ou time
-- ============================================================
create function public.in_group(p_folder_id uuid, p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case when p_folder_id is not null then public.is_folder_member(p_folder_id)
              else public.is_team_member(p_team_id) end;
$$;

-- Quem é do grupo (para o ranking e os avisos)
create function public._group_members(p_folder_id uuid, p_team_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from public.folder_members where p_folder_id is not null and folder_id = p_folder_id
  union
  select user_id from public.team_members where p_folder_id is null and team_id = p_team_id;
$$;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.folders (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  starts_on date not null,
  days integer not null check (days between 1 and 365),
  ends_on date generated always as (starts_on + days - 1) stored,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint challenges_one_group check ((folder_id is null) <> (team_id is null))
);
create index challenges_folder_idx on public.challenges (folder_id);
create index challenges_team_idx on public.challenges (team_id);
alter table public.challenges enable row level security;
revoke insert, update, delete on public.challenges from anon, authenticated;
create policy "challenges_select" on public.challenges for select to authenticated
  using (public.in_group(folder_id, team_id));

-- "Iniciar novo desafio": quem gerencia o projeto (ou administra o time)
create function public.start_challenge(p_folder_id uuid, p_team_id uuid, p_name text, p_days integer,
                                       p_starts_on date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_root uuid;
  v_group_name text;
  v_by text;
  v_start date;
  v_user uuid;
begin
  if (p_folder_id is null) = (p_team_id is null) then
    raise exception 'Escolha um projeto ou um time' using errcode = '22023';
  end if;
  if p_folder_id is not null then
    select coalesce(parent_id, id), name into v_root, v_group_name from public.folders where id = p_folder_id;
    if v_root is null or not public.has_permission(v_root, 'page.manage') then
      raise exception 'Seu cargo não cria desafios neste projeto' using errcode = '42501';
    end if;
  else
    if not public.is_team_member(p_team_id, 'admin') then
      raise exception 'Só quem administra o time cria desafios' using errcode = '42501';
    end if;
    select name into v_group_name from public.teams where id = p_team_id;
  end if;
  v_start := coalesce(p_starts_on, (now() at time zone coalesce(
    (select timezone from public.profiles where id = auth.uid()), 'America/Sao_Paulo'))::date);

  insert into public.challenges (folder_id, team_id, name, starts_on, days, created_by)
  values (v_root, p_team_id, trim(p_name), v_start, p_days, auth.uid())
  returning id into v_id;

  select display_name into v_by from public.profiles where id = auth.uid();
  for v_user in select u from public._group_members(v_root, p_team_id) u where u <> auth.uid() loop
    insert into public.notifications (user_id, kind, payload)
    values (v_user, 'challenge_started', jsonb_build_object(
      'by', v_by, 'name', trim(p_name), 'days', p_days, 'challenge_id', v_id, 'group_name', v_group_name));
  end loop;
  return v_id;
end;
$$;

-- Encerrar antes do fim (quem criou ou quem gerencia): apaga o desafio
create function public.delete_challenge(p_challenge_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if v_challenge.id is null or not (
       v_challenge.created_by = auth.uid()
       or (v_challenge.folder_id is not null and public.has_permission(v_challenge.folder_id, 'page.manage'))
       or (v_challenge.team_id is not null and public.is_team_member(v_challenge.team_id, 'admin'))) then
    raise exception 'Desafio não encontrado' using errcode = 'P0002';
  end if;
  delete from public.challenges where id = p_challenge_id;
end;
$$;

-- Ranking: cada pessoa do grupo com os dias de treino dentro do desafio (o app monta o placar)
create function public.challenge_board(p_challenge_id uuid)
returns table (user_id uuid, display_name text, days date[])
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if v_challenge.id is null or not public.in_group(v_challenge.folder_id, v_challenge.team_id) then
    raise exception 'Desafio não encontrado' using errcode = 'P0002';
  end if;
  return query
    select m.u, p.display_name,
           coalesce(array_agg(d.day order by d.day) filter (where d.day is not null), '{}')
    from public._group_members(v_challenge.folder_id, v_challenge.team_id) m(u)
    join public.profiles p on p.id = m.u
    left join public.workout_days d on d.user_id = m.u
      and d.day between v_challenge.starts_on and v_challenge.ends_on
    group by m.u, p.display_name;
end;
$$;

-- ============================================================
-- Mural (check-ins e comentários) e chat do grupo
-- ============================================================
create table public.group_posts (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.folders (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- checkin: treino do dia no mural · message: chat · comment: comentário de um check-in
  kind text not null check (kind in ('checkin', 'message', 'comment')),
  parent_id uuid references public.group_posts (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  -- Storage, bucket group-photos: f|t/<grupo>/<user>/<arquivo>
  photo_path text,
  created_at timestamptz not null default now(),
  constraint group_posts_one_group check ((folder_id is null) <> (team_id is null)),
  constraint group_posts_comment_parent check ((kind = 'comment') = (parent_id is not null)),
  constraint group_posts_not_empty check (char_length(trim(body)) > 0 or photo_path is not null)
);
create index group_posts_folder_idx on public.group_posts (folder_id, created_at desc);
create index group_posts_team_idx on public.group_posts (team_id, created_at desc);
create index group_posts_parent_idx on public.group_posts (parent_id);
alter table public.group_posts enable row level security;
revoke insert, update, delete on public.group_posts from anon, authenticated;
grant insert (id, folder_id, team_id, kind, parent_id, body, photo_path) on public.group_posts to authenticated;
grant delete on public.group_posts to authenticated;

create policy "group_posts_select" on public.group_posts for select to authenticated
  using (public.in_group(folder_id, team_id));
create policy "group_posts_insert" on public.group_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.in_group(folder_id, team_id)
    and (folder_id is null or not exists (select 1 from public.folders f where f.id = folder_id and f.parent_id is not null))
    and (photo_path is null or photo_path like (case when folder_id is not null then 'f/' || folder_id else 't/' || team_id end)
                                              || '/' || (select auth.uid()) || '/%')
  );
create policy "group_posts_delete" on public.group_posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Comentário fica no mesmo grupo do check-in
create function public.group_posts_parent_guard()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_parent public.group_posts;
begin
  if new.parent_id is not null then
    select * into v_parent from public.group_posts where id = new.parent_id;
    if v_parent.kind <> 'checkin' or v_parent.folder_id is distinct from new.folder_id
       or v_parent.team_id is distinct from new.team_id then
      raise exception 'Comentário só em check-in do mesmo grupo' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger group_posts_parent_guard
  before insert on public.group_posts
  for each row execute function public.group_posts_parent_guard();

create table public.group_post_reactions (
  post_id uuid not null references public.group_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏', '❤️')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
alter table public.group_post_reactions enable row level security;
revoke insert, update, delete on public.group_post_reactions from anon, authenticated;
grant insert (post_id, emoji) on public.group_post_reactions to authenticated;
grant delete on public.group_post_reactions to authenticated;

create function public.can_see_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.group_posts p where p.id = p_post_id and public.in_group(p.folder_id, p.team_id));
$$;
create policy "group_post_reactions_select" on public.group_post_reactions for select to authenticated
  using (public.can_see_post(post_id));
create policy "group_post_reactions_insert" on public.group_post_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see_post(post_id));
create policy "group_post_reactions_delete" on public.group_post_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.challenges, public.group_posts, public.group_post_reactions;

-- Fotos do check-in: bucket privado; lê quem é do grupo, envia e apaga só a própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create function public.can_see_group_path(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case (storage.foldername(p_name))[1]
    when 'f' then public.is_folder_member(((storage.foldername(p_name))[2])::uuid)
    when 't' then public.is_team_member(((storage.foldername(p_name))[2])::uuid)
    else false end;
$$;

create policy "group-photos: ler" on storage.objects for select to authenticated
  using (bucket_id = 'group-photos' and public.can_see_group_path(name));
create policy "group-photos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-photos' and public.can_see_group_path(name)
              and (storage.foldername(name))[3] = (select auth.uid())::text);
create policy "group-photos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'group-photos' and (storage.foldername(name))[3] = (select auth.uid())::text);

-- Meus grupos com desafio ou mural: para a lista "Desafios" (projetos e times)
create function public.my_challenges()
returns table (id uuid, folder_id uuid, team_id uuid, group_name text, name text, starts_on date,
               ends_on date, days integer)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.folder_id, c.team_id, coalesce(f.name, t.name), c.name, c.starts_on, c.ends_on, c.days
  from public.challenges c
  left join public.folders f on f.id = c.folder_id
  left join public.teams t on t.id = c.team_id
  where public.in_group(c.folder_id, c.team_id)
  order by c.ends_on desc, c.created_at desc;
$$;

revoke execute on function public._record_workout_day(uuid, text, uuid, integer), public._is_workout_page(uuid),
  public._page_all_done(uuid), public.tasks_workout_day(), public._group_members(uuid, uuid),
  public.group_posts_parent_guard()
  from public, anon, authenticated;
revoke execute on function public.in_group(uuid, uuid), public.start_challenge(uuid, uuid, text, integer, date),
  public.delete_challenge(uuid), public.challenge_board(uuid), public.can_see_post(uuid),
  public.can_see_group_path(text), public.my_challenges()
  from public, anon;
grant execute on function public.in_group(uuid, uuid), public.start_challenge(uuid, uuid, text, integer, date),
  public.delete_challenge(uuid), public.challenge_board(uuid), public.can_see_post(uuid),
  public.can_see_group_path(text), public.my_challenges()
  to authenticated;
