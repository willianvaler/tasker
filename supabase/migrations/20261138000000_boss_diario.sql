-- V4 §1.1 (O1): boss diário. Nasce à meia-noite no fuso do perfil e vai até o fim do dia; nível
-- próprio (diários derrotados); HP = o maior entre o do nível (hpBase × hpGrowth^(n−1), até
-- hpMaxFactor × hpBase) e recentFactor × o dano médio dos dias ativos recentes (para quem usa muito).
-- Todo golpe vale para o diário, o semanal e o do clã. Recompensa menor e item só por chance.
-- Valores provisórios (V4-1); a calibragem do dano vem na O2.

alter table public.bosses drop constraint bosses_scope_check;
alter table public.bosses add constraint bosses_scope_check check (scope in ('user', 'daily', 'folder', 'clan'));
drop policy "bosses_select" on public.bosses;
create policy "bosses_select" on public.bosses for select to authenticated using (
  (scope in ('user', 'daily') and scope_id = (select auth.uid()))
  or (scope = 'folder' and public.is_folder_member(scope_id))
  or (scope = 'clan' and scope_id = public.my_clan()));

create or replace function public.xp_rules()
returns jsonb
language sql immutable set search_path = ''
as $$
  select $json$
{
  "xp": {
    "task": 10,
    "priorityMultiplier": [
      1,
      1,
      1.25,
      1.5
    ],
    "habit": 8,
    "streakBonusPerDay": 1,
    "streakBonusMax": 20,
    "checklistItem": 5,
    "pageBonus": 25,
    "pageBonusMinItems": 3,
    "habitPlus": 3,
    "pomodoro": 5
  },
  "antiFarm": {
    "tooFastSeconds": 30,
    "quickSeconds": 300,
    "dailyQuickCap": 50,
    "dailyQuickDamageCap": 20,
    "habitPlusDailyCap": 10,
    "pomodoroDailyCap": 4,
    "pomodoroMinMinutes": 15
  },
  "level": {
    "base": 100,
    "exponent": 1.4
  },
  "boss": {
    "hpBase": 120,
    "hpGrowth": 1.2,
    "recentWeeks": 4,
    "recentFactor": 0.8,
    "rewardXp": 50,
    "rewardGold": 20,
    "rewardGoldPerLevel": 10,
    "noDropGold": 25
  },
  "dailyBoss": {
    "hpBase": 24,
    "hpGrowth": 1.05,
    "hpMaxFactor": 3,
    "recentDays": 14,
    "recentFactor": 0.7,
    "rewardXp": 15,
    "rewardGold": 5,
    "rewardGoldPerLevel": 1,
    "noDropGold": 5,
    "dropChance": 0.15
  },
  "damage": {
    "task": 4,
    "habit": 3,
    "checklistItem": 2,
    "pageBonus": 8,
    "habitPlus": 2,
    "habitMinusHeal": 3,
    "perPoint": 0.05,
    "critPerAgi": 0.02,
    "critMax": 0.6,
    "critMultiplier": 2,
    "weightStep": 0.25
  },
  "gold": {
    "task": 2,
    "habit": 1,
    "checklistItem": 1,
    "pageBonus": 5,
    "habitPlus": 1,
    "perCon": 0.03
  },
  "attributes": {
    "base": 1,
    "pointsPerLevel": 1,
    "healReducePerCon": 0.08,
    "healReduceMax": 0.8
  },
  "classes": {
    "lutador": {
      "str": 3,
      "agi": 0,
      "int": 0,
      "con": 1
    },
    "mago": {
      "str": 0,
      "agi": 1,
      "int": 3,
      "con": 0
    },
    "arqueiro": {
      "str": 1,
      "agi": 3,
      "int": 0,
      "con": 0
    },
    "paladino": {
      "str": 0,
      "agi": 0,
      "int": 1,
      "con": 3
    },
    "ladino": {
      "str": 1,
      "agi": 2,
      "int": 0,
      "con": 1
    }
  },
  "skills": {
    "firstStrikeMultiplier": 2,
    "streakFocusPerDay": 0.02,
    "streakFocusMax": 0.3,
    "archerCritMultiplier": 2.5,
    "paladinHealReduce": 0.5,
    "rogueGoldBonus": 0.5,
    "furyBonus": 0.5,
    "stormBonus": 0.5,
    "aimCritBonus": 0.25,
    "blessingBonus": 0.3,
    "ambushMultiplier": 2
  },
  "habits": {
    "maxTarget": 100
  }
}
  $json$::jsonb;
$$;

create function public.daily_boss_hp(p_level integer)
returns integer
language sql immutable set search_path = ''
as $$
  select round(least(
    (public.xp_rules() #>> '{dailyBoss,hpBase}')::numeric
      * power((public.xp_rules() #>> '{dailyBoss,hpGrowth}')::numeric, greatest(p_level, 1) - 1),
    (public.xp_rules() #>> '{dailyBoss,hpBase}')::numeric * (public.xp_rules() #>> '{dailyBoss,hpMaxFactor}')::numeric
  ))::integer;
$$;

create function public.ensure_daily_boss(p_user uuid)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_key text;
  v_boss public.bosses;
  v_rules jsonb := public.xp_rules() -> 'dailyBoss';
  v_level integer;
  v_recent numeric;
  v_hp integer;
  v_names text[] := array['Diabrete do Dia', 'Goblin das Miudezas', 'Slime da Rotina', 'Morcego da Distração',
                          'Gremlin do Celular', 'Rato das Pendências', 'Fantasma da Soneca'];
  v_icons text[] := array['👺', '👹', '🟢', '🦇', '📱', '🐀', '👻'];
  v_pick integer;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  if v_tz is null then
    return null;
  end if;
  v_today := (now() at time zone v_tz)::date;
  v_key := to_char(v_today, 'YYYY-MM-DD');
  select * into v_boss from public.bosses where scope = 'daily' and scope_id = p_user and period_key = v_key;
  if v_boss.id is not null then
    return v_boss;
  end if;

  update public.bosses set status = 'escaped'
  where scope = 'daily' and scope_id = p_user and status = 'active';

  v_level := 1 + (select count(*) from public.bosses where scope = 'daily' and scope_id = p_user and status = 'defeated');
  -- Média dos dias com golpe nas últimas semanas (dias parados não baixam o boss de quem usa muito)
  select coalesce(avg(total), 0) into v_recent from (
    select sum(damage) as total from public.xp_events
    where user_id = p_user and not reverted and damage > 0
      and day >= v_today - (v_rules ->> 'recentDays')::integer and day < v_today
    group by day) d;
  v_hp := greatest(public.daily_boss_hp(v_level), round(v_recent * (v_rules ->> 'recentFactor')::numeric)::integer);
  v_pick := (extract(doy from v_today)::integer % cardinality(v_names)) + 1;

  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, level, starts_at, ends_at)
  values ('daily', p_user, v_names[v_pick], v_icons[v_pick], v_key, v_hp, v_hp, v_level,
          v_today::timestamp at time zone v_tz, (v_today + 1)::timestamp at time zone v_tz)
  on conflict (scope, scope_id, period_key) do nothing
  returning * into v_boss;
  if v_boss.id is null then
    select * into v_boss from public.bosses where scope = 'daily' and scope_id = p_user and period_key = v_key;
  end if;
  return v_boss;
end;
$$;

-- Dias seguidos com o diário derrotado, terminando hoje (ou ontem, se o de hoje ainda está de pé)
create function public.daily_boss_streak(p_user uuid)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_day date := public.user_today(p_user);
  v_count integer := 0;
begin
  if not exists (select 1 from public.bosses where scope = 'daily' and scope_id = p_user
                 and period_key = to_char(v_day, 'YYYY-MM-DD') and status = 'defeated') then
    v_day := v_day - 1;
  end if;
  while exists (select 1 from public.bosses where scope = 'daily' and scope_id = p_user
                and period_key = to_char(v_day, 'YYYY-MM-DD') and status = 'defeated') loop
    v_count := v_count + 1;
    v_day := v_day - 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.ensure_daily_boss(uuid), public.daily_boss_streak(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._grant_event(p_user uuid, p_kind text, p_amount integer, p_quick boolean, p_task_id uuid, p_page_id uuid, p_completion_id uuid, p_cycle_key text, p_damage integer, p_crit boolean, p_gold integer, p_id uuid DEFAULT NULL::uuid, OUT event_id uuid, OUT boss_defeated boolean)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_boss public.bosses;
  v_heal integer;
begin
  boss_defeated := false;
  insert into public.xp_events (id, user_id, task_id, page_id, completion_id, cycle_key, kind, amount, quick, day,
                                damage, crit, gold)
  values (coalesce(p_id, gen_random_uuid()), p_user, p_task_id, p_page_id, p_completion_id, p_cycle_key, p_kind,
          p_amount, p_quick, public.user_today(p_user), greatest(p_damage, 0), p_crit and p_damage > 0, p_gold)
  on conflict do nothing
  returning id into event_id;

  if event_id is null or p_damage = 0 then
    return;
  end if;
  foreach v_boss in array array[
    public.ensure_daily_boss(p_user),
    public.ensure_weekly_boss(p_user),
    public.ensure_clan_boss((select clan_id from public.clan_members where user_id = p_user))
  ] loop
    continue when v_boss.id is null or v_boss.status = 'escaped';
    if p_damage > 0 then
      -- Dano conta mesmo com o boss já derrotado: desmarcar uma tarefa antiga não o ressuscita
      -- se as conclusões seguintes cobrem o HP
      insert into public.boss_damage (boss_id, user_id, xp_event_id, amount) values (v_boss.id, p_user, event_id, p_damage);
    elsif v_boss.status = 'active' then
      -- Cura só o que já tinha apanhado
      v_heal := least(-p_damage, v_boss.max_hp - v_boss.hp);
      continue when v_heal <= 0;
      insert into public.boss_damage (boss_id, user_id, xp_event_id, amount) values (v_boss.id, p_user, event_id, -v_heal);
    else
      continue;
    end if;
    boss_defeated := public._settle_boss(v_boss.id) or boss_defeated;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public._sync_boss_rewards(p_boss bosses)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rules jsonb := public.xp_rules() -> 'boss';
  v_recipients uuid[];
  v_changed uuid[] := '{}';
  v_user uuid;
  v_event uuid;
  v_item text;
  v_gold integer;
begin
  if p_boss.status = 'defeated' then
    v_recipients := case p_boss.scope
      when 'user' then array[p_boss.scope_id]
      when 'daily' then array[p_boss.scope_id]
      when 'clan' then (select array_agg(user_id) from (
        select user_id from public.boss_damage where boss_id = p_boss.id group by user_id having sum(amount) > 0) d)
      else (select array_agg(distinct t.completed_by) from public.tasks t
            where public.folder_root(t.folder_id) = p_boss.scope_id and t.parent_task_id is null
              and t.status = 'done' and t.completed_by is not null and t.completed_at >= p_boss.starts_at)
    end;
  end if;
  v_recipients := coalesce(v_recipients, '{}');

  -- Tira de quem não está mais na lista (o item ganho vai junto)
  for v_event, v_user in
    update public.xp_events set reverted = true, reverted_at = now()
    where boss_id = p_boss.id and kind = 'boss_reward' and not reverted and not (user_id = any (v_recipients))
    returning id, user_id
  loop
    delete from public.user_items where event_id = v_event;
    v_changed := v_changed || v_user;
  end loop;

  -- Dá para quem falta
  -- O diário dá menos e o item é só uma chance (V4 §1.1)
  if p_boss.scope = 'daily' then
    v_rules := public.xp_rules() -> 'dailyBoss';
  end if;
  v_gold := (v_rules ->> 'rewardGold')::integer + (v_rules ->> 'rewardGoldPerLevel')::integer * (p_boss.level - 1);
  foreach v_user in array v_recipients loop
    continue when exists (select 1 from public.xp_events e where e.boss_id = p_boss.id and e.user_id = v_user
                          and e.kind = 'boss_reward' and not e.reverted);
    v_item := case when p_boss.scope <> 'daily' or random() < (v_rules ->> 'dropChance')::numeric
                   then public._roll_drop(v_user, p_boss.level) end;
    insert into public.xp_events (user_id, boss_id, kind, amount, gold, day)
    values (v_user, p_boss.id, 'boss_reward', (v_rules ->> 'rewardXp')::integer,
            v_gold + case when v_item is null then (v_rules ->> 'noDropGold')::integer else 0 end,
            public.user_today(v_user))
    returning id into v_event;
    if v_item is not null then
      insert into public.user_items (user_id, item_key, source, event_id) values (v_user, v_item, 'drop', v_event);
    end if;
    v_changed := v_changed || v_user;
  end loop;

  -- O XP dos outros também muda: refaz o cache e confere conquistas de cada um
  foreach v_user in array v_changed loop
    perform public._refresh_profile_stats(v_user);
    perform public._check_achievements(v_user);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public._check_achievements(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile public.profiles;
  v_done integer;
  v_bosses integer;
  v_tz text;
  v_keys text[] := '{}';
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  v_tz := coalesce(v_profile.timezone, 'America/Sao_Paulo');
  select count(*) into v_done from public.xp_events
  where user_id = p_user and not reverted and kind in ('task', 'too_fast');
  -- O diário tem contagem e conquistas próprias (O4/P2): aqui, só semanal, clã e projeto
  select count(*) into v_bosses from public.xp_events e
  where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'
    and not exists (select 1 from public.bosses b where b.id = e.boss_id and b.scope = 'daily');

  if v_done >= 1 then v_keys := array_append(v_keys, 'first_task'); end if;
  if v_done >= 10 then v_keys := array_append(v_keys, 'tasks_10'); end if;
  if v_done >= 100 then v_keys := array_append(v_keys, 'tasks_100'); end if;
  if v_done >= 500 then v_keys := array_append(v_keys, 'tasks_500'); end if;
  if v_done >= 1000 then v_keys := array_append(v_keys, 'tasks_1000'); end if;
  if v_profile.streak_best >= 3 then v_keys := array_append(v_keys, 'streak_3'); end if;
  if v_profile.streak_best >= 7 then v_keys := array_append(v_keys, 'streak_7'); end if;
  if v_profile.streak_best >= 30 then v_keys := array_append(v_keys, 'streak_30'); end if;
  if v_profile.streak_best >= 100 then v_keys := array_append(v_keys, 'streak_100'); end if;
  if v_profile.level >= 3 then v_keys := array_append(v_keys, 'level_3'); end if;
  if v_profile.level >= 5 then v_keys := array_append(v_keys, 'level_5'); end if;
  if v_profile.level >= 10 then v_keys := array_append(v_keys, 'level_10'); end if;
  if v_profile.level >= 20 then v_keys := array_append(v_keys, 'level_20'); end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'page_bonus') then
    v_keys := array_append(v_keys, 'page_complete');
  end if;
  if v_bosses >= 1 then v_keys := array_append(v_keys, 'first_boss'); end if;
  if v_bosses >= 5 then v_keys := array_append(v_keys, 'boss_5'); end if;
  if v_bosses >= 25 then v_keys := array_append(v_keys, 'boss_25'); end if;
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
  if v_profile.attr_str + v_profile.attr_agi + v_profile.attr_int + v_profile.attr_con >= 5 then
    v_keys := array_append(v_keys, 'attr_5');
  end if;
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
  if (select count(*) from public.user_items where user_id = p_user) >= 10 then v_keys := array_append(v_keys, 'collector'); end if;
  if (select coalesce(sum(gold), 0) from public.xp_events where user_id = p_user and not reverted) >= 500 then
    v_keys := array_append(v_keys, 'gold_500');
  end if;
  if exists (select 1 from public.xp_events e join public.tasks t on t.id = e.task_id
             where e.user_id = p_user and not e.reverted and e.kind = 'task' and t.habit_kind = 'counter') then
    v_keys := array_append(v_keys, 'counter_goal');
  end if;
  if (select count(*) from public.xp_events where user_id = p_user and not reverted and kind = 'habit_plus') >= 50 then
    v_keys := array_append(v_keys, 'plus_50');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) < 7) then
    v_keys := array_append(v_keys, 'early_bird');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) >= 23) then
    v_keys := array_append(v_keys, 'night_owl');
  end if;

  -- Conquista não é retirada ao desmarcar (não vale XP, então não há o que farmar)
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

CREATE OR REPLACE FUNCTION public.game_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_boss public.bosses;
  v_daily public.bosses;
  v_clan public.clans;
  v_clan_boss public.bosses;
  v_level record;
  v_streak record;
  v_attr record;
  v_today date;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  v_daily := public.ensure_daily_boss(v_user);
  v_boss := public.ensure_weekly_boss(v_user);
  select * into v_clan from public.clans where id = public.my_clan();
  v_clan_boss := public.ensure_clan_boss(v_clan.id);
  -- A sequência muda com o tempo (o dia virou sem atividade), então o cache é refeito na leitura
  perform public._refresh_profile_stats(v_user);
  select * into v_profile from public.profiles where id = v_user;
  v_today := public.user_today(v_user);
  select * into v_level from public.level_for_xp(v_profile.xp);
  select * into v_streak from public.streak_stats(v_user, v_today);
  select * into v_attr from public.character_attributes(v_user);

  return jsonb_build_object(
    'enabled', v_profile.gamification_enabled,
    'xp', v_profile.xp,
    'level', v_level.level,
    'into_level', v_level.into_level,
    'for_next', v_level.for_next,
    'streak', v_streak.current_streak,
    'streak_best', v_streak.best_streak,
    'freeze_available', v_streak.freeze_available,
    'active_today', exists (select 1 from public.xp_events where user_id = v_user and day = v_today
                            and not reverted and kind in ('task', 'too_fast', 'habit_plus')),
    'xp_today', (select coalesce(sum(amount), 0) from public.xp_events
                 where user_id = v_user and day = v_today and not reverted),
    'damage_today', (select coalesce(sum(damage), 0) from public.xp_events
                     where user_id = v_user and day = v_today and not reverted),
    'tasks_done', (select count(*) from public.xp_events
                   where user_id = v_user and not reverted and kind in ('task', 'too_fast')),
    'bosses_defeated', (select count(*) from public.xp_events e
                        where e.user_id = v_user and not e.reverted and e.kind = 'boss_reward'
                          and not exists (select 1 from public.bosses b where b.id = e.boss_id and b.scope = 'daily')),
    'daily_defeated', (select count(*) from public.bosses where scope = 'daily' and scope_id = v_user and status = 'defeated'),
    'daily_streak', public.daily_boss_streak(v_user),
    'best_hit', (select coalesce(max(damage), 0) from public.xp_events where user_id = v_user and not reverted),
    'gold', public.gold_balance(v_user),
    'class', v_profile.class,
    'attributes', jsonb_build_object('str', v_attr.str, 'agi', v_attr.agi, 'int', v_attr.intel, 'con', v_attr.con),
    'allocated', jsonb_build_object('str', v_profile.attr_str, 'agi', v_profile.attr_agi,
                                    'int', v_profile.attr_int, 'con', v_profile.attr_con),
    'points', public.attribute_points(v_user),
    'skill_active', v_profile.class is not null and v_profile.skill_day is not distinct from v_today,
    'first_strike_ready', not exists (select 1 from public.xp_events where user_id = v_user and day = v_today
                                      and not reverted and damage > 0),
    -- Só o que a pessoa ainda tem (um item de boss revertido sai do equipamento)
    'equipped', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each_text(v_profile.equipped) e
                          where exists (select 1 from public.user_items u where u.user_id = v_user and u.item_key = e.value)),
                         '{}'),
    'inventory', coalesce((select jsonb_agg(item_key order by acquired_at) from public.user_items where user_id = v_user), '[]'),
    'boss', public._boss_json(v_boss),
    'daily_boss', public._boss_json(v_daily),
    'clan', case when v_clan.id is null then null else jsonb_build_object(
      'id', v_clan.id, 'name', v_clan.name, 'icon', v_clan.icon,
      'members', (select count(*) from public.clan_members where clan_id = v_clan.id)) end,
    'clan_boss', public._boss_json(v_clan_boss),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', a.key, 'name', a.name, 'description', a.description, 'icon', a.icon,
        'unlocked_at', ua.unlocked_at) order by a.position), '[]')
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_key = a.key and ua.user_id = v_user
    )
  );
end;
$function$;
