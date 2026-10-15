-- V3 §6 (M3): peso da tarefa (1 a 5; vazio vale 1). Pesa no progresso da mãe (no app) e no dano
-- ao boss: o golpe cresce `weightStep` por ponto acima de 1 (peso 5 = 2×); o XP não muda (o peso é
-- escolhido por quem faz, não pode virar farm). A estimativa já alimenta a soma na mãe e o caminho
-- crítico (G3, I3).

alter table public.tasks add column weight smallint check (weight between 1 and 5);
grant insert (weight), update (weight) on public.tasks to authenticated;

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

create function public.weight_factor(p_weight smallint)
returns numeric
language sql immutable set search_path = ''
as $$
  select 1 + (public.xp_rules() #>> '{damage,weightStep}')::numeric * (coalesce(p_weight, 1) - 1);
$$;

create or replace function public._award_leaf_completion(
  p_task public.tasks, p_page public.pages, p_completion_id uuid, p_cycle_kind text, p_created_done boolean
)
returns jsonb -- {xp, damage, crit, gold, boss_defeated}
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules();
  v_today date;
  v_key text;
  v_base integer;
  v_dmg_base numeric;
  v_gold_base integer;
  v_category text := 'routine';
  v_amount integer;
  v_kind text := 'task';
  v_quick boolean;
  v_routine boolean := p_page.view_type in ('cards', 'habits');
  v_age interval := now() - p_task.created_at;
  v_used integer;
  v_hit record;
  v_damage integer := 0;
  v_crit boolean := false;
  v_gold integer := 0;
  v_grant record;
  v_xp integer := 0;
  v_dealt integer := 0;
  v_crit_any boolean := false;
  v_gold_total integer := 0;
  v_defeated boolean := false;
  v_items integer;
  v_open integer;
  v_cycle text;
  v_streak integer;
begin
  if v_user is null then
    return jsonb_build_object('xp', 0, 'damage', 0, 'crit', false, 'gold', 0, 'boss_defeated', false);
  end if;
  v_today := public.user_today(v_user);
  select cycle_key into v_cycle from public.task_completions where id = p_completion_id;
  v_key := case
    when p_cycle_kind = 'manual' then 'd:' || v_today
    when v_cycle like 'r:%' then 'r:' || v_today
    else v_cycle
  end;
  v_streak := least((public.streak_stats(v_user, v_today)).current_streak * (v_rules #>> '{xp,streakBonusPerDay}')::integer,
                    (v_rules #>> '{xp,streakBonusMax}')::integer);

  -- Valores base pelo tipo de item
  if p_page.view_type = 'habits' or (p_page.view_type not in ('cards') and p_task.parent_task_id is null
                                      and p_task.recurrence is not null) then
    v_base := (v_rules #>> '{xp,habit}')::integer + v_streak;
    v_dmg_base := (v_rules #>> '{damage,habit}')::numeric;
    v_gold_base := (v_rules #>> '{gold,habit}')::integer;
  elsif p_page.view_type = 'cards' or p_task.parent_task_id is not null then
    v_base := (v_rules #>> '{xp,checklistItem}')::integer;
    v_dmg_base := (v_rules #>> '{damage,checklistItem}')::numeric;
    v_gold_base := (v_rules #>> '{gold,checklistItem}')::integer;
  else
    v_category := 'task';
    v_base := round((v_rules #>> '{xp,task}')::integer
                    * (v_rules -> 'xp' -> 'priorityMultiplier' ->> least(greatest(p_task.priority, 0), 3))::numeric);
    v_dmg_base := (v_rules #>> '{damage,task}')::numeric
                  * (v_rules -> 'xp' -> 'priorityMultiplier' ->> least(greatest(p_task.priority, 0), 3))::numeric;
    v_gold_base := (v_rules #>> '{gold,task}')::integer;
  end if;

  -- Peso da tarefa (M3): o golpe cresce com o peso (o XP não muda)
  v_dmg_base := v_dmg_base * public.weight_factor(p_task.weight);

  if p_created_done then
    -- [x] do lote: só registra (D35)
    v_kind := 'too_fast';
    v_amount := 0;
    v_quick := false;
  else
    v_quick := v_age < make_interval(secs => (v_rules #>> '{antiFarm,quickSeconds}')::integer);
    select * into v_hit from public._attack(v_user, v_category, v_dmg_base,
                                            p_task.due_date is not null and p_task.due_date < v_today);
    v_damage := v_hit.damage;
    v_crit := v_hit.crit;
    if v_quick then
      v_damage := public._cap_quick_damage(v_user, v_damage);
    end if;
    if not v_routine and v_age < make_interval(secs => (v_rules #>> '{antiFarm,tooFastSeconds}')::integer) then
      -- Relâmpago: 0 XP e 0 ouro, mas o golpe no boss vale (dentro do teto de dano rápido, D60)
      v_kind := 'too_fast';
      v_amount := 0;
    else
      v_amount := v_base;
      if v_quick then
        select coalesce(sum(amount), 0) into v_used from public.xp_events
        where user_id = v_user and day = v_today and quick and not reverted;
        v_amount := least(v_amount, greatest(0, (v_rules #>> '{antiFarm,dailyQuickCap}')::integer - v_used));
      end if;
      v_gold := case when v_amount > 0 then public._gold_for(v_user, v_gold_base) else 0 end;
    end if;
  end if;

  select * into v_grant from public._grant_event(v_user, v_kind, v_amount, v_quick, p_task.id, p_page.id,
                                                 p_completion_id, v_key, v_damage, v_crit, v_gold);
  if v_grant.event_id is not null then
    v_xp := v_amount;
    v_dealt := v_damage;
    v_crit_any := v_crit and v_damage > 0;
    v_gold_total := v_gold;
    v_defeated := v_grant.boss_defeated;
  end if;

  -- Bônus da página de cards inteira no ciclo
  if p_page.view_type = 'cards' and p_task.parent_task_id is null and v_kind = 'task' then
    select count(*), count(*) filter (where status <> 'done') into v_items, v_open
    from public.tasks where page_id = p_page.id and parent_task_id is null;
    if v_open = 0 and v_items >= (v_rules #>> '{xp,pageBonusMinItems}')::integer then
      v_quick := now() - p_page.created_at < make_interval(secs => (v_rules #>> '{antiFarm,quickSeconds}')::integer);
      v_amount := (v_rules #>> '{xp,pageBonus}')::integer;
      select * into v_hit from public._attack(v_user, 'routine', (v_rules #>> '{damage,pageBonus}')::numeric, false);
      v_damage := v_hit.damage;
      if v_quick then
        select coalesce(sum(amount), 0) into v_used from public.xp_events
        where user_id = v_user and day = v_today and quick and not reverted;
        v_amount := least(v_amount, greatest(0, (v_rules #>> '{antiFarm,dailyQuickCap}')::integer - v_used));
        v_damage := public._cap_quick_damage(v_user, v_damage);
      end if;
      v_gold := case when v_amount > 0 then public._gold_for(v_user, (v_rules #>> '{gold,pageBonus}')::integer) else 0 end;
      select * into v_grant from public._grant_event(v_user, 'page_bonus', v_amount, v_quick, null, p_page.id,
                                                     null, v_key, v_damage, v_hit.crit, v_gold);
      if v_grant.event_id is not null then
        v_xp := v_xp + v_amount;
        v_dealt := v_dealt + v_damage;
        v_crit_any := v_crit_any or (v_hit.crit and v_damage > 0);
        v_gold_total := v_gold_total + v_gold;
        v_defeated := v_defeated or v_grant.boss_defeated;
      end if;
    end if;
  end if;

  return jsonb_build_object('xp', v_xp, 'damage', v_dealt, 'crit', v_crit_any, 'gold', v_gold_total,
                            'boss_defeated', v_defeated);
end;
$$;

-- Duplicar e copiar a página levam o peso (e a estimativa)
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
                              position, meta, habit_kind, habit_target, created_by, repeat_plan, weight, estimate_minutes)
    select m.new_id, v_new_id, pm.new_id, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
           t.position, t.meta, t.habit_kind, t.habit_target, auth.uid(), t.repeat_plan, t.weight, t.estimate_minutes
    from public.tasks t
    join _dup_map m on m.old_id = t.id
    left join _dup_map pm on pm.old_id = t.parent_task_id
    where t.page_id = p_page_id and t.depth = v_level;
  end loop;

  return v_new_id;
end;
$$;

create or replace function public._copy_page_for_me(p_page_id uuid, p_folder_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_folder uuid;
  v_new uuid := gen_random_uuid();
  v_level integer;
begin
  select * into v_page from public.pages where id = p_page_id;
  select id into v_folder from public.folders
  where owner_id = auth.uid() and parent_id is null and not is_inbox and kind = 'folder'
    and name = coalesce(nullif(trim(p_folder_name), ''), 'Recebidas')
  limit 1;
  if v_folder is null then
    insert into public.folders (name, kind) values (coalesce(nullif(trim(p_folder_name), ''), 'Recebidas'), 'folder')
    returning id into v_folder;
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position)
  values (v_new, v_folder, v_page.name, v_page.icon, v_page.view_type, v_page.reset_cycle,
          coalesce((select max(position) + 1 from public.pages where folder_id = v_folder), 0));

  drop table if exists _copy_map;
  create temp table _copy_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;
  for v_level in 1 .. (public.tree_limits() ->> 'hard_max_depth')::int loop
    insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, labels, recurrence,
                              position, meta, habit_kind, habit_target, created_by, repeat_plan, estimate_minutes, weight)
    select m.new_id, v_new, pm.new_id, t.title, t.notes, t.priority, t.labels, t.recurrence,
           t.position, t.meta, t.habit_kind, t.habit_target, auth.uid(), t.repeat_plan, t.estimate_minutes, t.weight
    from public.tasks t
    join _copy_map m on m.old_id = t.id
    left join _copy_map pm on pm.old_id = t.parent_task_id
    where t.page_id = p_page_id and t.depth = v_level;
  end loop;
  return v_new;
end;
$$;
