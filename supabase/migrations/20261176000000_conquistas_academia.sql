-- AC11 (V6 §9, D244): conquistas de academia, numa categoria própria. As de faixa saem das
-- séries novas de _achievement_progress (recordes, dias com série, toneladas); as especiais
-- (corpo inteiro na semana, supino do próprio peso) ficam no _check_achievements. O recorde já
-- vale crítico garantido (D237).

alter table public.achievements drop constraint achievements_category_check;
alter table public.achievements add constraint achievements_category_check check (category in (
  'tasks', 'streak', 'bosses', 'levels', 'character', 'habits', 'projects', 'gym', 'special'));

insert into public.achievements (key, name, description, icon, position, rarity, category, series, goal, secret) values
  ('first_record', 'Primeiro recorde', 'Bater o primeiro recorde pessoal num exercício', '🏋️', 170, 'common', 'gym', 'gym_records', 1, false),
  ('records_10', '10 recordes', 'Bater 10 recordes pessoais', '📈', 171, 'uncommon', 'gym', 'gym_records', 10, false),
  ('records_50', '50 recordes', 'Bater 50 recordes pessoais', '🚀', 172, 'rare', 'gym', 'gym_records', 50, false),
  ('records_100', '100 recordes', 'Bater 100 recordes pessoais', '🏆', 173, 'epic', 'gym', 'gym_records', 100, false),
  ('gym_days_50', '50 treinos', 'Treinar em 50 dias diferentes', '💪', 174, 'uncommon', 'gym', 'gym_days', 50, false),
  ('gym_days_100', '100 treinos', 'Treinar em 100 dias diferentes', '🦾', 175, 'rare', 'gym', 'gym_days', 100, false),
  ('gym_days_365', '365 treinos', 'Treinar em 365 dias diferentes', '🗻', 176, 'epic', 'gym', 'gym_days', 365, false),
  ('tons_10', '10 toneladas', 'Levantar 10 toneladas somando todas as séries', '🪨', 177, 'uncommon', 'gym', 'gym_tons', 10, false),
  ('tons_100', '100 toneladas', 'Levantar 100 toneladas somando todas as séries', '⛰️', 178, 'epic', 'gym', 'gym_tons', 100, false),
  ('full_body_week', 'Corpo inteiro', 'Treinar peito, costas, ombros, braços, pernas e abdômen na mesma semana', '🧍', 179, 'uncommon', 'gym', null, null, false),
  ('bench_bodyweight', 'Supino do próprio peso', 'Ter 1RM estimado no supino igual ou maior que o seu peso', '⚖️', 180, 'epic', 'gym', null, null, false);

-- Séries de academia no progresso
CREATE OR REPLACE FUNCTION public._achievement_progress(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_user;
  return jsonb_build_object(
    'tasks', (select count(*) from public.xp_events
              where user_id = p_user and not reverted and kind in ('task', 'too_fast')),
    'streak', coalesce(v_profile.streak_best, 0),
    'level', coalesce(v_profile.level, 1),
    'rebirths', coalesce(v_profile.rebirths, 0),
    'bosses', (select count(*) from public.xp_events e
               where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'
                 and not exists (select 1 from public.bosses b where b.id = e.boss_id and b.scope = 'daily')),
    'daily_bosses', (select count(*) from public.xp_events e
                     join public.bosses b on b.id = e.boss_id and b.scope = 'daily'
                     where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'),
    'daily_streak', public.daily_boss_streak(p_user),
    'attributes', coalesce(v_profile.attr_str + v_profile.attr_agi + v_profile.attr_int + v_profile.attr_con, 0),
    'items', (select count(*) from public.user_items where user_id = p_user),
    'gold', (select coalesce(sum(gold), 0) from public.xp_events where user_id = p_user and not reverted),
    'habit_plus', (select count(*) from public.xp_events
                   where user_id = p_user and not reverted and kind = 'habit_plus'),
    -- Marcar hábito: conclusão numa página de hábitos, mais cada "+" do bom/ruim
    'habits', (select count(*) from public.xp_events e
               join public.tasks t on t.id = e.task_id
               join public.pages p on p.id = t.page_id
               where e.user_id = p_user and not e.reverted and e.kind in ('task', 'too_fast')
                 and (p.is_habits or p.view_type = 'habits'))
              + (select count(*) from public.xp_events
                 where user_id = p_user and not reverted and kind = 'habit_plus'),
    'estimates', (select count(*) from public.tasks
                  where completed_by = p_user and status = 'done' and estimate_minutes is not null),
    'delegated', (select count(*) from public.tasks
                  where created_by = p_user and status = 'done'
                    and completed_by is not null and completed_by <> p_user),
    -- Projeto concluído: o projeto (e as subpastas) com 5 tarefas ou mais, todas feitas
    'projects', (
      select count(*) from public.folders f
      where f.kind = 'project'
        and f.id in (select folder_id from public.folder_members where user_id = p_user)
        and (
          with recursive tree as (
            select f.id union all
            select c.id from public.folders c join tree on c.parent_id = tree.id
          )
          select count(*) >= 5 and bool_and(t.status = 'done')
          from public.tasks t where t.folder_id in (select id from tree)
        )
    ),
    'teams', (select count(*) from public.teams where created_by = p_user),
    'team_size', coalesce((select max(n) from (
      select count(*) as n from public.team_members m
      join public.teams tm on tm.id = m.team_id and tm.created_by = p_user
      group by m.team_id) s), 0),
    -- Academia (AC11): recordes, dias com série e toneladas (aquecimento fora)
    'gym_records', (select count(*) from public.workout_sets
                    where user_id = p_user and records <> '{}'),
    'gym_days', (select count(distinct (performed_at at time zone coalesce(v_profile.timezone, 'America/Sao_Paulo'))::date)
                 from public.workout_sets where user_id = p_user and not warmup),
    'gym_tons', (select floor(coalesce(sum(weight_kg * reps), 0) / 1000) from public.workout_sets
                 where user_id = p_user and not warmup)
  );
end;
$function$;

-- As especiais de academia
CREATE OR REPLACE FUNCTION public._check_achievements(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile public.profiles;
  v_progress jsonb := public._achievement_progress(p_user);
  v_tz text;
  v_keys text[];
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  v_tz := coalesce(v_profile.timezone, 'America/Sao_Paulo');

  -- Faixas: a meta da série alcançada (P2)
  select coalesce(array_agg(key), '{}') into v_keys from public.achievements
  where series is not null and coalesce((v_progress ->> series)::numeric, 0) >= goal;

  -- Especiais: uma condição própria cada
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'page_bonus') then
    v_keys := array_append(v_keys, 'page_complete');
  end if;
  if exists (select 1 from public.xp_events e join public.bosses b on b.id = e.boss_id
             where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward' and b.level >= 5) then
    v_keys := array_append(v_keys, 'boss_level_5');
  end if;
  if exists (select 1 from public.xp_events e join public.bosses b on b.id = e.boss_id
             where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward' and b.scope = 'clan') then
    v_keys := array_append(v_keys, 'clan_boss');
  end if;
  if exists (select 1 from public.bosses b where b.scope = 'folder' and b.status = 'defeated'
             and public.folder_root(b.scope_id) in (select folder_id from public.folder_members where user_id = p_user)) then
    v_keys := array_append(v_keys, 'project_done');
  end if;
  if v_profile.class is not null then v_keys := array_append(v_keys, 'class_chosen'); end if;
  if v_profile.skill_day is not null then v_keys := array_append(v_keys, 'first_skill'); end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and crit) then
    v_keys := array_append(v_keys, 'first_crit');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and damage >= 15) then
    v_keys := array_append(v_keys, 'big_hit');
  end if;
  if exists (select 1 from public.user_items where user_id = p_user and source = 'shop') then
    v_keys := array_append(v_keys, 'first_purchase');
  end if;
  if exists (select 1 from public.user_items where user_id = p_user and source = 'drop') then
    v_keys := array_append(v_keys, 'first_drop');
  end if;
  if exists (select 1 from public.xp_events e join public.tasks t on t.id = e.task_id
             where e.user_id = p_user and not e.reverted and e.kind = 'task' and t.habit_kind = 'counter') then
    v_keys := array_append(v_keys, 'counter_goal');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) < 7) then
    v_keys := array_append(v_keys, 'early_bird');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) >= 23) then
    v_keys := array_append(v_keys, 'night_owl');
  end if;
  -- Quem mais bateu num boss de clã derrotado (só os bosses em que a pessoa bateu)
  if exists (
    select 1 from public.bosses b
    where b.scope = 'clan' and b.status = 'defeated'
      and exists (select 1 from public.boss_damage d where d.boss_id = b.id and d.user_id = p_user)
      and (select d.user_id from public.boss_damage d where d.boss_id = b.id
           group by d.user_id order by sum(d.amount) desc, min(d.created_at) limit 1) = p_user
  ) then
    v_keys := array_append(v_keys, 'clan_top');
  end if;
  if exists (select 1 from public.tasks where completed_by = p_user and status = 'done' and depth >= 5) then
    v_keys := array_append(v_keys, 'tree_5');
  end if;
  -- Academia (AC11): peito, costas, ombros, braços, pernas e abdômen como alvo na mesma semana
  if exists (
    select 1 from (
      select date_trunc('week', w.performed_at at time zone v_tz) as wk,
             array_agg(distinct case
               when e.target = 'chest' then 'chest'
               when e.target in ('upper_back', 'lats', 'lower_back', 'traps') then 'back'
               when e.target = 'shoulders' then 'shoulders'
               when e.target in ('biceps', 'triceps', 'forearms') then 'arms'
               when e.target in ('quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors') then 'legs'
               when e.target in ('abs', 'obliques') then 'core' end) as groups
      from public.workout_sets w join public.exercises e on e.id = w.exercise_id
      where w.user_id = p_user and not w.warmup
      group by 1) s
    where s.groups @> array['chest', 'back', 'shoulders', 'arms', 'legs', 'core']
  ) then
    v_keys := array_append(v_keys, 'full_body_week');
  end if;
  -- 1RM estimado no supino igual ou maior que o peso do corpo mais recente (se registrado)
  if exists (
    select 1 from public.workout_sets w join public.exercises e on e.id = w.exercise_id
    where w.user_id = p_user and not w.warmup and e.name_en ilike '%bench press%'
      and public._e1rm(w.weight_kg, w.reps) >= (
        select b.value from public.body_metrics b where b.user_id = p_user and b.kind = 'weight'
        order by b.measured_on desc, b.created_at desc limit 1)
  ) then
    v_keys := array_append(v_keys, 'bench_bodyweight');
  end if;
  -- Secretas
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) = 0
             and extract(minute from created_at at time zone v_tz) < 5) then
    v_keys := array_append(v_keys, 'midnight');
  end if;
  if exists (select 1 from (
               select created_at - lag(created_at) over (order by created_at) as gap
               from public.xp_events
               where user_id = p_user and not reverted and kind in ('task', 'too_fast')) g
             where g.gap >= interval '30 days') then
    v_keys := array_append(v_keys, 'comeback');
  end if;
  if exists (select 1 from public.xp_events
             where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             group by (created_at at time zone v_tz)::date having count(*) >= 50) then
    v_keys := array_append(v_keys, 'fifty_day');
  end if;
  if exists (select 1 from public.time_entries
             where user_id = p_user and source = 'pomodoro'
             group by (ended_at at time zone v_tz)::date having count(*) >= 8) then
    v_keys := array_append(v_keys, 'pomodoro_8');
  end if;

  with inserted as (
    insert into public.user_achievements (user_id, achievement_key)
    select p_user, k from unnest(v_keys) k
    on conflict do nothing
    returning achievement_key
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'icon', a.icon) order by a.position), '[]')
  into v_new
  from inserted i join public.achievements a on a.key = i.achievement_key;
  return v_new;
end;
$function$;

-- Ordem do catálogo com Academia antes das especiais (como em 20261145000000_conquistas_novas)
with ordered as (
  select key, row_number() over (
    order by array_position(array['tasks', 'streak', 'bosses', 'levels', 'character', 'habits', 'projects', 'gym', 'special'], category),
             array_position(array['tasks', 'estimates', 'streak', 'bosses', 'daily_bosses', 'daily_streak', 'level',
                                  'attributes', 'items', 'gold', 'habit_plus', 'habits', 'projects', 'delegated',
                                  'teams', 'team_size', 'gym_records', 'gym_days', 'gym_tons'], series) nulls last,
             goal nulls last, position) as n
  from public.achievements
)
update public.achievements a set position = o.n from ordered o where o.key = a.key;
