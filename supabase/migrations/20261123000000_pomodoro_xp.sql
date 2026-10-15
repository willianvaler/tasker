-- V3 §5.1 (K4): XP por pomodoro, pequeno e com limite diário, concedido pelo servidor quando o
-- foco termina de verdade (o mesmo _timer_finished que registra o tempo). Apagar o registro do
-- pomodoro devolve o XP. Espelho dos valores: src/lib/gamification.config.ts.

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
      "critMultiplier": 2
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

alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in (
  'task', 'too_fast', 'page_bonus', 'boss_reward', 'habit_plus', 'habit_minus', 'pomodoro'));

-- Recebe o id (com a linha como parâmetro, o PostgREST a exporia como coluna calculada)
create or replace function public._timer_finished(p_timer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p_timer public.timers;
  v_minutes integer;
  v_entry uuid;
  v_rules jsonb := public.xp_rules();
begin
  select * into p_timer from public.timers where id = p_timer_id;
  if p_timer.id is null or p_timer.state <> 'done' then
    return;
  end if;
  if p_timer.kind = 'pomodoro' and coalesce(p_timer.config ->> 'phase', 'focus') = 'focus' then
    if now() < p_timer.ends_at - interval '5 seconds' or p_timer.duration_seconds is null then
      return;
    end if;
    v_minutes := greatest(1, round(p_timer.duration_seconds / 60.0)::integer);
  elsif p_timer.kind = 'stopwatch' and p_timer.task_id is not null then
    -- Menos de meio minuto não vira registro (toque sem querer)
    if extract(epoch from p_timer.ends_at - p_timer.started_at) < 30 then
      return;
    end if;
    v_minutes := least(1440, greatest(1, round(extract(epoch from p_timer.ends_at - p_timer.started_at) / 60.0)::integer));
  else
    return;
  end if;
  insert into public.time_entries (user_id, task_id, source, timer_id, started_at, ended_at, minutes)
  values (p_timer.user_id,
          case when p_timer.task_id is not null and exists (select 1 from public.tasks where id = p_timer.task_id)
               then p_timer.task_id end,
          case when p_timer.kind = 'pomodoro' then 'pomodoro' else 'stopwatch' end,
          p_timer.id, p_timer.started_at, greatest(p_timer.ends_at, p_timer.started_at), v_minutes)
  on conflict (timer_id) do nothing
  returning id into v_entry;

  -- XP do pomodoro (K4): foco de verdade (mínimo de minutos), até o limite do dia; o evento tem o
  -- id do timer, então não se repete
  if v_entry is not null and p_timer.kind = 'pomodoro'
     and v_minutes >= (v_rules #>> '{antiFarm,pomodoroMinMinutes}')::integer
     and (select count(*) from public.xp_events
          where user_id = p_timer.user_id and kind = 'pomodoro' and not reverted
            and day = public.user_today(p_timer.user_id))
         < (v_rules #>> '{antiFarm,pomodoroDailyCap}')::integer
     and (select gamification_enabled from public.profiles where id = p_timer.user_id) is not false then
    perform public._grant_event(p_timer.user_id, 'pomodoro', (v_rules #>> '{xp,pomodoro}')::integer, false,
                                p_timer.task_id, null, null, null, 0, false, 0, p_timer.id);
    perform public._refresh_profile_stats(p_timer.user_id);
  end if;
end;
$$;

create or replace function public.delete_time_entry(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry public.time_entries;
begin
  delete from public.time_entries where id = p_id and user_id = auth.uid() returning * into v_entry;
  if v_entry.id is null then
    if exists (select 1 from public.time_entries where id = p_id) then
      raise exception 'Só quem registrou apaga' using errcode = '42501';
    end if;
    return;
  end if;
  -- O XP do pomodoro sai junto
  if v_entry.source = 'pomodoro' and v_entry.timer_id is not null then
    perform public._revert_xp(array[v_entry.timer_id]);
    perform public._refresh_profile_stats(auth.uid());
  end if;
end;
$$;
