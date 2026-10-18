-- V4 §2 (P1, D180): conquistas com raridade, categoria, série/meta e secretas; % de jogadores.
--
-- Raridade sai da dificuldade (decisão provisória V4-3): comum, incomum, rara, épica, lendária.
-- A porcentagem de jogadores que têm cada uma é calculada de hora em hora (achievement_stats).
-- "Série" + "meta": conquistas de faixa (tarefas ≥ 100, sequência ≥ 30...) — o progresso até a
-- próxima sai de _achievement_progress, a mesma conta que a P2 usa para conceder.

alter table public.achievements
  add column rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  add column category text not null default 'special'
    check (category in ('tasks', 'streak', 'bosses', 'levels', 'character', 'habits', 'projects', 'special')),
  add column series text,
  add column goal integer check (goal is null or goal > 0),
  add column secret boolean not null default false,
  add constraint achievements_series_goal check ((series is null) = (goal is null));

update public.achievements a set rarity = v.rarity, category = v.category, series = v.series, goal = v.goal
from (values
  ('first_task', 'common', 'tasks', 'tasks', 1),
  ('tasks_10', 'common', 'tasks', 'tasks', 10),
  ('tasks_100', 'uncommon', 'tasks', 'tasks', 100),
  ('tasks_500', 'rare', 'tasks', 'tasks', 500),
  ('tasks_1000', 'rare', 'tasks', 'tasks', 1000),
  ('page_complete', 'common', 'tasks', null, null),
  ('streak_3', 'common', 'streak', 'streak', 3),
  ('streak_7', 'uncommon', 'streak', 'streak', 7),
  ('streak_30', 'rare', 'streak', 'streak', 30),
  ('streak_100', 'epic', 'streak', 'streak', 100),
  ('level_3', 'common', 'levels', 'level', 3),
  ('level_5', 'common', 'levels', 'level', 5),
  ('level_10', 'uncommon', 'levels', 'level', 10),
  ('level_20', 'rare', 'levels', 'level', 20),
  ('first_boss', 'common', 'bosses', 'bosses', 1),
  ('boss_5', 'uncommon', 'bosses', 'bosses', 5),
  ('boss_25', 'rare', 'bosses', 'bosses', 25),
  ('boss_level_5', 'rare', 'bosses', null, null),
  ('clan_boss', 'uncommon', 'bosses', null, null),
  ('project_done', 'rare', 'projects', null, null),
  ('class_chosen', 'common', 'character', null, null),
  ('first_skill', 'common', 'character', null, null),
  ('attr_5', 'common', 'character', 'attributes', 5),
  ('first_crit', 'common', 'character', null, null),
  ('big_hit', 'uncommon', 'character', null, null),
  ('first_purchase', 'common', 'character', null, null),
  ('first_drop', 'uncommon', 'character', null, null),
  ('collector', 'uncommon', 'character', 'items', 10),
  ('gold_500', 'uncommon', 'character', 'gold', 500),
  ('counter_goal', 'common', 'habits', null, null),
  ('plus_50', 'uncommon', 'habits', 'habit_plus', 50),
  ('early_bird', 'uncommon', 'special', null, null),
  ('night_owl', 'uncommon', 'special', null, null)
) as v(key, rarity, category, series, goal)
where a.key = v.key;

-- Quantos jogadores têm cada conquista (de hora em hora; contar a cada abertura da tela pesaria)
create table public.achievement_stats (
  achievement_key text primary key references public.achievements(key) on delete cascade,
  holders integer not null default 0,
  players integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.achievement_stats enable row level security;
create policy "achievement_stats: todos leem" on public.achievement_stats for select to authenticated using (true);
revoke insert, update, delete on public.achievement_stats from anon, authenticated;

create function public.refresh_achievement_stats()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_players integer;
begin
  -- Jogadores: quem ganhou algo no jogo nos últimos 90 dias (conta parada não pesa)
  select count(distinct user_id) into v_players from public.xp_events
  where created_at > now() - interval '90 days';
  insert into public.achievement_stats (achievement_key, holders, players, updated_at)
  select a.key, coalesce(h.n, 0), v_players, now()
  from public.achievements a
  left join (
    select ua.achievement_key, count(*) as n
    from public.user_achievements ua
    where ua.user_id in (select user_id from public.xp_events where created_at > now() - interval '90 days')
    group by ua.achievement_key
  ) h on h.achievement_key = a.key
  on conflict (achievement_key) do update
  set holders = excluded.holders, players = excluded.players, updated_at = excluded.updated_at;
end;
$$;
revoke execute on function public.refresh_achievement_stats() from public, anon, authenticated;
select cron.schedule('questlist-conquistas-stats', '17 * * * *', $$select public.refresh_achievement_stats()$$);
select public.refresh_achievement_stats();

-- Os números das séries de uma pessoa (o mesmo que concede as conquistas de faixa, na P2)
create function public._achievement_progress(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_user;
  return jsonb_build_object(
    'tasks', (select count(*) from public.xp_events
              where user_id = p_user and not reverted and kind in ('task', 'too_fast')),
    'streak', coalesce(v_profile.streak_best, 0),
    'level', coalesce(v_profile.level, 1),
    'bosses', (select count(*) from public.xp_events e
               where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'
                 and not exists (select 1 from public.bosses b where b.id = e.boss_id and b.scope = 'daily')),
    'attributes', coalesce(v_profile.attr_str + v_profile.attr_agi + v_profile.attr_int + v_profile.attr_con, 0),
    'items', (select count(*) from public.user_items where user_id = p_user),
    'gold', (select coalesce(sum(gold), 0) from public.xp_events where user_id = p_user and not reverted),
    'habit_plus', (select count(*) from public.xp_events
                   where user_id = p_user and not reverted and kind = 'habit_plus')
  );
end;
$$;
revoke execute on function public._achievement_progress(uuid) from public, anon, authenticated;

-- Tela de conquistas (P3): catálogo com raridade, categoria, a própria conquista, % de jogadores e
-- o progresso das séries. Secreta não conquistada sai sem ícone (o app mostra só a dica)
create function public.my_achievements()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Entre na conta' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', a.key,
        'icon', case when a.secret and ua.unlocked_at is null then null else a.icon end,
        'rarity', a.rarity, 'category', a.category, 'series', a.series, 'goal', a.goal,
        'secret', a.secret, 'unlocked_at', ua.unlocked_at,
        'pct', case when s.players > 0 then round(100.0 * s.holders / s.players, 1) end
      ) order by a.position), '[]')
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_key = a.key and ua.user_id = v_user
      left join public.achievement_stats s on s.achievement_key = a.key
    ),
    'progress', public._achievement_progress(v_user)
  );
end;
$$;
revoke execute on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;
