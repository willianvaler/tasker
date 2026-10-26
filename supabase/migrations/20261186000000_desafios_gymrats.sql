-- V6 AC15C (D252, D280): Desafios estilo GymRats. O desafio passa a ser o próprio grupo: tem
-- membros (challenge_members), código e link para entrar, mural e chat próprios, e o ranking é
-- configurável (dias ativos, atividades, minutos ou pontos). Cada treino concluído no app é uma
-- atividade (workout_activities), com duração, séries e volume, gravada no servidor nos mesmos
-- pontos que já contavam o dia de treino (D184). Os desafios de projeto ou de time migram: quem
-- era do grupo vira membro, e o mural e o chat do grupo vão para o desafio mais recente dele.

-- ============================================================
-- Desafio com membros e código
-- ============================================================
alter table public.challenges drop constraint challenges_one_group;
-- O projeto ou o time de onde o desafio saiu (opcional); quem participa está em challenge_members
alter table public.challenges add constraint challenges_at_most_one_group
  check (folder_id is null or team_id is null);
alter table public.challenges
  add column scoring text not null default 'days'
    check (scoring in ('days', 'activities', 'minutes', 'points')),
  add column code text unique check (code is null or code ~ '^[A-Z2-9]{8}$');

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_members_user on public.challenge_members (user_id);
alter table public.challenge_members enable row level security;
revoke insert, update, delete on public.challenge_members from anon, authenticated;

create function public.in_challenge(p_challenge_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.challenge_members
                 where challenge_id = p_challenge_id and user_id = (select auth.uid()));
$$;

create policy "challenge_members_select" on public.challenge_members for select to authenticated
  using (public.in_challenge(challenge_id));
drop policy "challenges_select" on public.challenges;
create policy "challenges_select" on public.challenges for select to authenticated
  using (public.in_challenge(id));

-- Código de 8 letras e números, sem os que confundem (0/O, 1/I/L)
create function public._challenge_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
    into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.challenges where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Quem cria entra; o desafio de um projeto ou time já nasce com o grupo dentro
create function public.challenges_seed_members()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.challenge_members (challenge_id, user_id)
  select new.id, u from (
    select new.created_by as u where new.created_by is not null
    union
    select m from public._group_members(new.folder_id, new.team_id) m
    where new.folder_id is not null or new.team_id is not null
  ) x
  on conflict do nothing;
  return null;
end;
$$;
create trigger challenges_seed_members
  after insert on public.challenges
  for each row execute function public.challenges_seed_members();

-- Os desafios de hoje: o grupo vira membro e ganha código
insert into public.challenge_members (challenge_id, user_id)
select c.id, m from public.challenges c
cross join lateral public._group_members(c.folder_id, c.team_id) m
on conflict do nothing;
insert into public.challenge_members (challenge_id, user_id)
select id, created_by from public.challenges where created_by is not null
on conflict do nothing;
update public.challenges set code = public._challenge_code() where code is null and finished_at is null;

-- ============================================================
-- Mural e chat do desafio
-- ============================================================
alter table public.group_posts add column challenge_id uuid references public.challenges (id) on delete cascade;
alter table public.group_posts drop constraint group_posts_one_group;
alter table public.group_posts add constraint group_posts_one_group
  check (num_nonnulls(folder_id, team_id, challenge_id) = 1);
create index group_posts_challenge_idx on public.group_posts (challenge_id, created_at desc);
create index group_posts_photo_idx on public.group_posts (photo_path) where photo_path is not null;
grant insert (challenge_id) on public.group_posts to authenticated;

create function public.in_post_group(p_folder_id uuid, p_team_id uuid, p_challenge_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case when p_challenge_id is not null then public.in_challenge(p_challenge_id)
              else public.in_group(p_folder_id, p_team_id) end;
$$;

drop policy "group_posts_select" on public.group_posts;
create policy "group_posts_select" on public.group_posts for select to authenticated
  using (public.in_post_group(folder_id, team_id, challenge_id));
drop policy "group_posts_insert" on public.group_posts;
create policy "group_posts_insert" on public.group_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.in_post_group(folder_id, team_id, challenge_id)
    and (folder_id is null or not exists (select 1 from public.folders f where f.id = folder_id and f.parent_id is not null))
    and (photo_path is null or photo_path like (case when challenge_id is not null then 'c/' || challenge_id
                                                     when folder_id is not null then 'f/' || folder_id
                                                     else 't/' || team_id end)
                                              || '/' || (select auth.uid()) || '/%')
  );

create or replace function public.group_posts_parent_guard()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_parent public.group_posts;
begin
  if new.parent_id is not null then
    select * into v_parent from public.group_posts where id = new.parent_id;
    if v_parent.kind <> 'checkin' or v_parent.folder_id is distinct from new.folder_id
       or v_parent.team_id is distinct from new.team_id
       or v_parent.challenge_id is distinct from new.challenge_id then
      raise exception 'Comentário só em check-in do mesmo grupo' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.can_see_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.group_posts p
                 where p.id = p_post_id and public.in_post_group(p.folder_id, p.team_id, p.challenge_id));
$$;

-- Foto: c/<desafio>/… pelo desafio; a de um post que migrou para um desafio, por ele também
create or replace function public.can_see_group_path(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case (storage.foldername(p_name))[1]
    when 'f' then public.is_folder_member(((storage.foldername(p_name))[2])::uuid)
    when 't' then public.is_team_member(((storage.foldername(p_name))[2])::uuid)
    when 'c' then public.in_challenge(((storage.foldername(p_name))[2])::uuid)
    else false end
    or exists (select 1 from public.group_posts p
               where p.photo_path = p_name and p.challenge_id is not null and public.in_challenge(p.challenge_id));
$$;

-- Envio de foto: na pasta do próprio desafio só para quem é dele
drop policy "group-photos: enviar" on storage.objects;
create policy "group-photos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-photos'
              and (storage.foldername(name))[1] in ('f', 't', 'c')
              and case (storage.foldername(name))[1]
                    when 'f' then public.is_folder_member(((storage.foldername(name))[2])::uuid)
                    when 't' then public.is_team_member(((storage.foldername(name))[2])::uuid)
                    else public.in_challenge(((storage.foldername(name))[2])::uuid) end
              and (storage.foldername(name))[3] = (select auth.uid())::text);

-- O mural e o chat do grupo vão para o desafio mais recente dele
with latest as (
  select distinct on (coalesce(folder_id, team_id)) id, folder_id, team_id
  from public.challenges
  where folder_id is not null or team_id is not null
  order by coalesce(folder_id, team_id), starts_on desc, created_at desc
)
update public.group_posts p set challenge_id = l.id, folder_id = null, team_id = null
from latest l
where (p.folder_id is not null and p.folder_id = l.folder_id)
   or (p.team_id is not null and p.team_id = l.team_id);

-- ============================================================
-- Atividades: cada treino concluído no app
-- ============================================================
create table public.workout_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  -- 'page': treino concluído · 'session': Modo Treino (30 min ou o treino todo feito)
  source text not null check (source in ('page', 'session')),
  page_id uuid references public.pages (id) on delete set null,
  minutes integer not null default 0 check (minutes between 0 and 720),
  sets integer not null default 0 check (sets >= 0),
  volume_kg numeric(12, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Um treino por dia vira uma atividade só (concluir a página e sair da sessão são o mesmo treino)
create unique index workout_activities_one on public.workout_activities (user_id, day, page_id)
  where page_id is not null;
create index workout_activities_user_day on public.workout_activities (user_id, day);
alter table public.workout_activities enable row level security;
revoke insert, update, delete on public.workout_activities from anon, authenticated;
create policy "workout_activities_select" on public.workout_activities for select to authenticated
  using (user_id = (select auth.uid()));

-- Pontos de uma atividade (espelho: activityPoints em src/lib/gym/leaderboard.ts):
-- 10 pelo treino, 1 por série feita (sem aquecimento) e 1 a cada 10 minutos
create function public._activity_points(p_minutes integer, p_sets integer)
returns integer
language sql immutable set search_path = ''
as $$
  select 10 + greatest(coalesce(p_sets, 0), 0) + greatest(coalesce(p_minutes, 0), 0) / 10;
$$;

-- Séries, volume e duração do treino da pessoa naquela página e naquele dia (pelo diário)
create function public._record_activity(p_user uuid, p_source text, p_page uuid, p_minutes integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text := coalesce((select timezone from public.profiles where id = p_user), 'America/Sao_Paulo');
  v_day date := (now() at time zone v_tz)::date;
  v_sets integer;
  v_volume numeric;
  v_span integer;
begin
  select count(*), coalesce(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)), 0),
         coalesce(floor(extract(epoch from max(s.performed_at) - min(s.performed_at)) / 60), 0)
  into v_sets, v_volume, v_span
  from public.workout_sets s
  where s.user_id = p_user and s.page_id = p_page and not s.warmup
    and (s.performed_at at time zone v_tz)::date = v_day;

  insert into public.workout_activities (user_id, day, source, page_id, minutes, sets, volume_kg)
  values (p_user, v_day, p_source, p_page, least(greatest(coalesce(p_minutes, 0), v_span), 720),
          v_sets, round(v_volume, 1))
  on conflict (user_id, day, page_id) where page_id is not null do update
  set minutes = greatest(public.workout_activities.minutes, excluded.minutes),
      sets = greatest(public.workout_activities.sets, excluded.sets),
      volume_kg = greatest(public.workout_activities.volume_kg, excluded.volume_kg),
      updated_at = now();
end;
$$;

-- O dia de treino (D184) grava a atividade junto
create or replace function public._record_workout_day(p_user uuid, p_source text, p_page uuid, p_minutes integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.workout_days (user_id, day, source, page_id, minutes)
  values (p_user, (now() at time zone coalesce(
            (select timezone from public.profiles where id = p_user), 'America/Sao_Paulo'))::date,
          p_source, p_page, p_minutes)
  on conflict (user_id, day) do update
  set minutes = greatest(public.workout_days.minutes, excluded.minutes);
  if p_page is not null then
    perform public._record_activity(p_user, p_source, p_page, p_minutes);
  end if;
end;
$$;

-- Os dias de treino que já existem viram atividades (com as séries do diário daquele dia)
insert into public.workout_activities (user_id, day, source, page_id, minutes, sets, volume_kg, created_at)
select d.user_id, d.day, d.source, d.page_id, least(coalesce(d.minutes, 0), 720),
       coalesce(x.sets, 0), coalesce(x.volume, 0), d.created_at
from public.workout_days d
left join public.profiles pr on pr.id = d.user_id
left join lateral (
  select count(*)::integer as sets, round(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)), 1) as volume
  from public.workout_sets s
  where s.user_id = d.user_id and s.page_id = d.page_id and not s.warmup
    and (s.performed_at at time zone coalesce(pr.timezone, 'America/Sao_Paulo'))::date = d.day
) x on d.page_id is not null
on conflict do nothing;

-- ============================================================
-- Ranking e prêmio pelo critério do desafio
-- ============================================================
-- O valor de cada membro: dias distintos, atividades, minutos ou pontos (espelho: leaderboard())
create function public._challenge_scores(p_challenge_id uuid)
returns table (user_id uuid, days integer, score integer)
language sql stable security definer set search_path = ''
as $$
  with c as (select * from public.challenges where id = p_challenge_id),
  members as (select m.user_id from public.challenge_members m where m.challenge_id = p_challenge_id),
  days as (
    select d.user_id, d.day from public.workout_days d, c
    where d.user_id in (select user_id from members) and d.day between c.starts_on and c.ends_on
    union
    select a.user_id, a.day from public.workout_activities a, c
    where a.user_id in (select user_id from members) and a.day between c.starts_on and c.ends_on
  ),
  acts as (
    select a.user_id, count(*)::integer as n, sum(a.minutes)::integer as minutes,
           sum(public._activity_points(a.minutes, a.sets))::integer as points
    from public.workout_activities a, c
    where a.user_id in (select user_id from members) and a.day between c.starts_on and c.ends_on
    group by a.user_id
  )
  select m.user_id, (select count(distinct d.day)::integer from days d where d.user_id = m.user_id),
         case (select scoring from c)
           when 'activities' then coalesce(a.n, 0)
           when 'minutes' then coalesce(a.minutes, 0)
           when 'points' then coalesce(a.points, 0)
           else (select count(distinct d.day)::integer from days d where d.user_id = m.user_id) end
  from members m left join acts a on a.user_id = m.user_id;
$$;

-- Pódio: até o 3º pelo critério (empatados dividem: 1, 1, 3), só quem treinou, e só quando pelo
-- menos duas pessoas treinaram. O mesmo que podium() no app.
create or replace function public._challenge_podium(p_challenge_id uuid)
returns table (user_id uuid, place integer, days integer)
language sql stable security definer set search_path = ''
as $$
  with ranked as (
    select s.user_id, s.days, rank() over (order by s.score desc)::integer as place
    from public._challenge_scores(p_challenge_id) s where s.days > 0
  )
  select r.user_id, r.place, r.days from ranked r
  where r.place <= 3 and (select count(*) from ranked) >= 2;
$$;

-- Ranking: cada membro com os dias de treino e as atividades dentro do desafio (o app monta o placar)
drop function public.challenge_board(uuid);
create function public.challenge_board(p_challenge_id uuid)
returns table (user_id uuid, display_name text, days date[], activities jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if v_challenge.id is null or not public.in_challenge(p_challenge_id) then
    raise exception 'Desafio não encontrado' using errcode = 'P0002';
  end if;
  return query
    select m.user_id, p.display_name,
           coalesce((select array_agg(d.day order by d.day) from public.workout_days d
                     where d.user_id = m.user_id and d.day between v_challenge.starts_on and v_challenge.ends_on), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('day', a.day, 'minutes', a.minutes, 'sets', a.sets,
                                                         'volume', a.volume_kg) order by a.day)
                     from public.workout_activities a
                     where a.user_id = m.user_id and a.day between v_challenge.starts_on and v_challenge.ends_on), '[]')
    from public.challenge_members m
    join public.profiles p on p.id = m.user_id
    where m.challenge_id = p_challenge_id;
end;
$$;

-- ============================================================
-- Criar, entrar, código, pessoas
-- ============================================================
-- Quem dá para trazer: amigos, gente dos times e dos grupos (projetos e pastas compartilhadas)
create function public.challenge_people()
returns table (user_id uuid, display_name text, source text)
language sql stable security definer set search_path = ''
as $$
  with candidates as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as user_id, 'friend' as source, 1 as rank
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_a, f.user_b)
    union all
    select o.user_id, 'team', 2
    from public.team_members t join public.team_members o on o.team_id = t.team_id
    where t.user_id = auth.uid()
    union all
    select o.user_id, 'group', 3
    from public.folder_members t
    join public.folders f on f.id = t.folder_id and f.parent_id is null
    join public.folder_members o on o.folder_id = t.folder_id
    where t.user_id = auth.uid() and (f.kind = 'project' or f.is_shared)
    union all
    select o.user_id, 'challenge', 4
    from public.challenge_members t join public.challenge_members o on o.challenge_id = t.challenge_id
    where t.user_id = auth.uid()
  )
  select c.user_id, pr.display_name, (array_agg(c.source order by c.rank))[1]
  from candidates c join public.profiles pr on pr.id = c.user_id
  where c.user_id <> auth.uid()
  group by c.user_id, pr.display_name
  order by min(c.rank), pr.display_name
  limit 300;
$$;

create function public._notify_challenge(p_challenge_id uuid, p_users uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_by text;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  select display_name into v_by from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, kind, payload)
  select u, 'challenge_started', jsonb_build_object(
    'by', v_by, 'name', v_challenge.name, 'days', v_challenge.days, 'challenge_id', v_challenge.id,
    'group_name', v_challenge.name)
  from unnest(p_users) u where u is distinct from auth.uid();
end;
$$;

-- "+" em Desafios: nome, dias, critério e quem vem junto. Com um projeto ou time de origem, vale a
-- regra de antes (quem gerencia o projeto ou administra o time) e o grupo inteiro entra
create function public.create_challenge(p_name text, p_days integer, p_scoring text default 'days',
                                        p_members uuid[] default '{}', p_folder_id uuid default null,
                                        p_team_id uuid default null, p_starts_on date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_root uuid;
  v_start date;
  v_user uuid;
  v_new uuid[];
begin
  if auth.uid() is null then
    raise exception 'Entre para criar um desafio' using errcode = '42501';
  end if;
  if p_folder_id is not null and p_team_id is not null then
    raise exception 'Escolha um projeto ou um time' using errcode = '22023';
  end if;
  if p_folder_id is not null then
    select coalesce(parent_id, id) into v_root from public.folders where id = p_folder_id;
    if v_root is null or not public.has_permission(v_root, 'page.manage') then
      raise exception 'Seu cargo não cria desafios neste projeto' using errcode = '42501';
    end if;
  elsif p_team_id is not null and not public.is_team_member(p_team_id, 'admin') then
    raise exception 'Só quem administra o time cria desafios' using errcode = '42501';
  end if;
  foreach v_user in array coalesce(p_members, '{}') loop
    if not exists (select 1 from public.challenge_people() c where c.user_id = v_user) then
      raise exception 'Só dá para trazer amigos e gente dos seus times e grupos' using errcode = '22023';
    end if;
  end loop;
  v_start := coalesce(p_starts_on, (now() at time zone coalesce(
    (select timezone from public.profiles where id = auth.uid()), 'America/Sao_Paulo'))::date);

  insert into public.challenges (folder_id, team_id, name, starts_on, days, created_by, scoring, code)
  values (v_root, p_team_id, trim(p_name), v_start, p_days, auth.uid(), p_scoring, public._challenge_code())
  returning id into v_id;
  insert into public.challenge_members (challenge_id, user_id)
  select v_id, u from unnest(coalesce(p_members, '{}')) u on conflict do nothing;

  select array_agg(user_id) into v_new from public.challenge_members where challenge_id = v_id;
  perform public._notify_challenge(v_id, v_new);
  return v_id;
end;
$$;

-- O "Iniciar novo desafio" do grupo (D184), para quem ainda usa o app de antes
create or replace function public.start_challenge(p_folder_id uuid, p_team_id uuid, p_name text, p_days integer,
                                                  p_starts_on date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if (p_folder_id is null) = (p_team_id is null) then
    raise exception 'Escolha um projeto ou um time' using errcode = '22023';
  end if;
  return public.create_challenge(p_name, p_days, 'days', '{}', p_folder_id, p_team_id, p_starts_on);
end;
$$;

-- Quem criou traz mais gente depois
create function public.add_challenge_members(p_challenge_id uuid, p_members uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_new uuid[];
begin
  if not exists (select 1 from public.challenges where id = p_challenge_id and created_by = auth.uid()) then
    raise exception 'Só quem criou o desafio traz gente' using errcode = '42501';
  end if;
  foreach v_user in array coalesce(p_members, '{}') loop
    if not exists (select 1 from public.challenge_people() c where c.user_id = v_user) then
      raise exception 'Só dá para trazer amigos e gente dos seus times e grupos' using errcode = '22023';
    end if;
  end loop;
  with ins as (
    insert into public.challenge_members (challenge_id, user_id)
    select p_challenge_id, u from unnest(coalesce(p_members, '{}')) u
    on conflict do nothing returning user_id
  )
  select array_agg(user_id) into v_new from ins;
  if v_new is not null then
    perform public._notify_challenge(p_challenge_id, v_new);
  end if;
end;
$$;

-- Código novo (o antigo para de valer) ou nenhum (ninguém mais entra pelo código)
create function public.set_challenge_code(p_challenge_id uuid, p_enabled boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  update public.challenges
  set code = case when p_enabled then public._challenge_code() end
  where id = p_challenge_id and created_by = auth.uid()
  returning code into v_code;
  if not found then
    raise exception 'Só quem criou o desafio muda o código' using errcode = '42501';
  end if;
  return v_code;
end;
$$;

-- Prévia do código (também sem login, para a tela do link): o nome, as datas e quantos estão
create function public.challenge_preview(p_code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'valid', true, 'id', c.id, 'name', c.name, 'starts_on', c.starts_on, 'ends_on', c.ends_on,
      'days', c.days, 'scoring', c.scoring,
      'members', (select count(*) from public.challenge_members m where m.challenge_id = c.id),
      'creator', (select display_name from public.profiles where id = c.created_by),
      'member', public.in_challenge(c.id),
      'over', c.finished_at is not null)
    from public.challenges c where c.code = upper(trim(p_code))),
    jsonb_build_object('valid', false));
$$;

-- Entrar pelo código ou pelo link: direto, enquanto o desafio não terminou
create function public.join_challenge(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  if auth.uid() is null then
    raise exception 'Entre para participar' using errcode = '42501';
  end if;
  select * into v_challenge from public.challenges where code = upper(trim(p_code));
  if v_challenge.id is null then
    raise exception 'Código inválido ou cancelado' using errcode = 'P0002';
  end if;
  if v_challenge.finished_at is not null then
    raise exception 'Este desafio já terminou' using errcode = '22023';
  end if;
  insert into public.challenge_members (challenge_id, user_id)
  values (v_challenge.id, auth.uid()) on conflict do nothing;
  return v_challenge.id;
end;
$$;

-- Quem criou tira alguém; cada um sai quando quiser (quem criou apaga em vez de sair)
create function public.remove_challenge_member(p_challenge_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid;
begin
  select created_by into v_creator from public.challenges where id = p_challenge_id;
  if p_user_id = auth.uid() then
    if v_creator = auth.uid() then
      raise exception 'Quem criou o desafio não sai: apague o desafio' using errcode = '22023';
    end if;
  elsif v_creator is distinct from auth.uid() then
    raise exception 'Só quem criou o desafio tira pessoas' using errcode = '42501';
  end if;
  delete from public.challenge_members where challenge_id = p_challenge_id and user_id = p_user_id;
end;
$$;

-- Apagar antes do fim: quem criou (e, no desafio de um projeto ou time, quem o gerencia)
create or replace function public.delete_challenge(p_challenge_id uuid)
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

-- Meus desafios (o bloco Desafios do Treino)
drop function public.my_challenges();
create function public.my_challenges()
returns table (id uuid, name text, starts_on date, ends_on date, days integer, scoring text,
               members integer, created_by uuid, finished_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.starts_on, c.ends_on, c.days, c.scoring,
         (select count(*)::integer from public.challenge_members o where o.challenge_id = c.id),
         c.created_by, c.finished_at
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = auth.uid()
  order by c.ends_on desc, c.created_at desc;
$$;

-- Aviso do fim: o nome do grupo pode faltar (desafio solto); fica o do desafio
create or replace function public.finish_challenges()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_group_name text;
  v_count integer := 0;
  r record;
begin
  for v_challenge in
    select c.* from public.challenges c
    left join public.profiles p on p.id = c.created_by
    where c.finished_at is null
      and c.ends_on < (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
    for update of c skip locked
  loop
    update public.challenges set finished_at = now(), code = null where id = v_challenge.id;
    v_count := v_count + 1;
    select coalesce((select name from public.folders where id = v_challenge.folder_id),
                    (select name from public.teams where id = v_challenge.team_id),
                    v_challenge.name)
    into v_group_name;

    for r in select * from public._challenge_podium(v_challenge.id) loop
      insert into public.user_achievements (user_id, achievement_key)
      values (r.user_id, 'challenge_podium') on conflict do nothing;
      if r.place = 1 then
        insert into public.user_achievements (user_id, achievement_key)
        values (r.user_id, 'challenge_win') on conflict do nothing;
        insert into public.user_items (user_id, item_key, source, price)
        values (r.user_id, 'title_campeao', 'prize', 0) on conflict do nothing;
      end if;
      insert into public.notifications (user_id, kind, payload)
      values (r.user_id, 'challenge_finished', jsonb_build_object(
        'name', v_challenge.name, 'place', r.place, 'days', r.days,
        'challenge_id', v_challenge.id, 'group_name', v_group_name));
    end loop;
  end loop;
  return v_count;
end;
$$;

alter publication supabase_realtime add table public.challenge_members;

revoke execute on function public._challenge_code(), public.challenges_seed_members(),
  public._activity_points(integer, integer), public._record_activity(uuid, text, uuid, integer),
  public._challenge_scores(uuid), public._notify_challenge(uuid, uuid[])
  from public, anon, authenticated;
revoke execute on function public.in_challenge(uuid), public.in_post_group(uuid, uuid, uuid),
  public.challenge_board(uuid), public.challenge_people(),
  public.create_challenge(text, integer, text, uuid[], uuid, uuid, date),
  public.add_challenge_members(uuid, uuid[]), public.set_challenge_code(uuid, boolean),
  public.join_challenge(text), public.remove_challenge_member(uuid, uuid), public.my_challenges()
  from public, anon;
grant execute on function public.in_challenge(uuid), public.in_post_group(uuid, uuid, uuid),
  public.challenge_board(uuid), public.challenge_people(),
  public.create_challenge(text, integer, text, uuid[], uuid, uuid, date),
  public.add_challenge_members(uuid, uuid[]), public.set_challenge_code(uuid, boolean),
  public.join_challenge(text), public.remove_challenge_member(uuid, uuid), public.my_challenges()
  to authenticated;
revoke execute on function public.challenge_preview(text) from public;
grant execute on function public.challenge_preview(text) to anon, authenticated;
