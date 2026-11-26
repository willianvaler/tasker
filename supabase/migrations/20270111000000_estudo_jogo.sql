-- ET2 (ESCOPO_V15 §6, V15-10): estudo conta para o jogo por regra do servidor.
--  - Sessão de revisão: cada {studySessionCards} cartões diferentes revisados no dia formam uma
--    sessão, que vale xp.study (sem dano nem ouro, como o pomodoro), até studyDailyCap por dia.
--    O XP é por sessão, nunca por cartão; o id do evento sai da pessoa, do dia e do número da
--    sessão, então rever, apagar e recriar cartões não repete. Só vale para revisão de hoje ou de
--    ontem (a feita sem internet que sobe depois), e nunca dentro de uma automação do V14.
--  - Sessão de leitura (ES7): o foco do pomodoro já vale XP pelo K4; aqui ele só passa a contar
--    para a sequência quando é de uma tarefa de projeto de estudo (evento 'reading', 0 XP).
--  - Os dois contam como dia ativo na sequência (streak_stats, game_state, last_active_date).
-- Espelho dos valores: src/lib/gamification.config.ts.

create or replace function public.xp_rules()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select $json${
  "rebirth": {
    "minLevel": 20,
    "bonusPerRebirth": 0.05,
    "maxBonus": 0.25
  },
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
    "pomodoro": 5,
    "study": 5
  },
  "antiFarm": {
    "tooFastSeconds": 30,
    "quickSeconds": 300,
    "dailyQuickCap": 50,
    "dailyQuickDamageCap": 50,
    "habitPlusDailyCap": 10,
    "pomodoroDailyCap": 4,
    "pomodoroMinMinutes": 15,
    "studySessionCards": 10,
    "studyDailyCap": 3
  },
  "level": {
    "base": 100,
    "exponent": 1.4
  },
  "boss": {
    "hpBase": 300,
    "hpGrowth": 1.2,
    "recentWeeks": 4,
    "recentFactor": 0.8,
    "rewardXp": 50,
    "rewardGold": 20,
    "rewardGoldPerLevel": 10,
    "noDropGold": 25
  },
  "dailyBoss": {
    "hpBase": 60,
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
    "task": 10,
    "habit": 8,
    "checklistItem": 5,
    "pageBonus": 20,
    "habitPlus": 5,
    "habitMinusHeal": 8,
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
  },
  "game": {
    "maxHp": 50,
    "dailyDamage": 2,
    "priorityWeight": [
      1,
      1,
      1.5,
      2
    ],
    "conReducePer": 0.004,
    "conReduceMin": 0.1,
    "baseMp": 30,
    "mpPerInt": 2,
    "mpPerTask": 1,
    "mpRegenMin": 10,
    "mpRegenPct": 0.1,
    "revivePrice": 500,
    "potionPrice": 25,
    "potionHeal": 15,
    "perfectDayDivisor": 2,
    "shieldFactor": 0.5,
    "armoirePrice": 100,
    "dropChance": 0.15,
    "dropDailyCap": 5,
    "feedFavorite": 5,
    "feedOther": 2,
    "feedToMount": 50,
    "scrollPrice": 150,
    "questDays": 14,
    "scrollDropShare": 0.05,
    "rarityBonus": {
      "common": 0,
      "rare": 1,
      "epic": 2,
      "legendary": 3
    },
    "slotAttribute": {
      "head": "con",
      "hand": "str",
      "pet": "agi",
      "aura": "int",
      "title": "none"
    },
    "pets": {
      "species": [
        "lobo",
        "raposa",
        "coruja",
        "cervo",
        "urso",
        "javali",
        "grifo",
        "dragao"
      ],
      "potions": [
        "comum",
        "sombra",
        "dourada",
        "gelo"
      ],
      "foods": {
        "comum": "carne",
        "sombra": "cogumelo",
        "dourada": "mel",
        "gelo": "peixe"
      }
    },
    "quests": [
      {
        "key": "dragao-do-prazo-perdido",
        "name": "Dragão do Prazo Perdido",
        "hp": 400
      },
      {
        "key": "bruxa-do-pantano",
        "name": "Bruxa do Pântano",
        "hp": 300
      },
      {
        "key": "cavaleiro-sem-fim",
        "name": "Cavaleiro Sem Fim",
        "hp": 500
      },
      {
        "key": "aranha-das-mensagens",
        "name": "Aranha das Mensagens",
        "hp": 350
      },
      {
        "key": "rei-esqueleto",
        "name": "Rei Esqueleto",
        "hp": 600
      },
      {
        "key": "golem-de-ferro",
        "name": "Golem de Ferro",
        "hp": 450
      }
    ],
    "portraits": [
      "f-clara",
      "f-escura",
      "m-clara",
      "m-escura"
    ],
    "backgrounds": [
      "acampamento",
      "taverna",
      "floresta",
      "castelo",
      "montanha",
      "masmorra"
    ],
    "manaSkills": {
      "lutador": [
        {
          "key": "golpe_brutal",
          "level": 3,
          "mana": 10,
          "effect": "strike",
          "power": 8
        },
        {
          "key": "pele_de_ferro",
          "level": 5,
          "mana": 20,
          "effect": "shield",
          "power": 1
        },
        {
          "key": "folego",
          "level": 8,
          "mana": 15,
          "effect": "heal",
          "power": 15
        },
        {
          "key": "investida",
          "level": 11,
          "mana": 30,
          "effect": "strike",
          "power": 20
        }
      ],
      "mago": [
        {
          "key": "bola_de_fogo",
          "level": 3,
          "mana": 10,
          "effect": "strike",
          "power": 9
        },
        {
          "key": "escudo_arcano",
          "level": 5,
          "mana": 20,
          "effect": "shield",
          "power": 1
        },
        {
          "key": "transmutacao",
          "level": 8,
          "mana": 25,
          "effect": "gold",
          "power": 20
        },
        {
          "key": "meteoro",
          "level": 11,
          "mana": 35,
          "effect": "strike",
          "power": 24
        }
      ],
      "arqueiro": [
        {
          "key": "tiro_certeiro",
          "level": 3,
          "mana": 10,
          "effect": "strike",
          "power": 8
        },
        {
          "key": "camuflagem",
          "level": 5,
          "mana": 25,
          "effect": "stealth",
          "power": 1
        },
        {
          "key": "cacada",
          "level": 8,
          "mana": 20,
          "effect": "gold",
          "power": 15
        },
        {
          "key": "chuva_de_flechas",
          "level": 11,
          "mana": 30,
          "effect": "strike",
          "power": 20
        }
      ],
      "paladino": [
        {
          "key": "luz_curativa",
          "level": 3,
          "mana": 15,
          "effect": "heal",
          "power": 15
        },
        {
          "key": "egide",
          "level": 5,
          "mana": 20,
          "effect": "shield",
          "power": 1
        },
        {
          "key": "bencao_do_grupo",
          "level": 8,
          "mana": 25,
          "effect": "healClan",
          "power": 10
        },
        {
          "key": "julgamento",
          "level": 11,
          "mana": 30,
          "effect": "strike",
          "power": 18
        }
      ],
      "ladino": [
        {
          "key": "punhalada",
          "level": 3,
          "mana": 10,
          "effect": "strike",
          "power": 8
        },
        {
          "key": "sombras",
          "level": 5,
          "mana": 30,
          "effect": "stealth",
          "power": 2
        },
        {
          "key": "bater_carteira",
          "level": 8,
          "mana": 15,
          "effect": "gold",
          "power": 15
        },
        {
          "key": "emboscada",
          "level": 11,
          "mana": 30,
          "effect": "strike",
          "power": 22
        }
      ]
    }
  }
}$json$::jsonb;
$function$;

alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in (
  'task', 'too_fast', 'page_bonus', 'boss_reward', 'habit_plus', 'habit_minus', 'pomodoro', 'skill',
  'study', 'reading'));

-- Sessão de revisão (trigger depois de cada revisão; a revisão é da própria pessoa pela RLS)
create function public._study_session(p_user uuid, p_day date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rules jsonb := public.xp_rules();
  v_size integer := (v_rules #>> '{antiFarm,studySessionCards}')::integer;
  v_cap integer := (v_rules #>> '{antiFarm,studyDailyCap}')::integer;
  v_today date := public.user_today(p_user);
  v_cards integer;
  v_session integer;
  v_event uuid;
  v_granted boolean := false;
begin
  if coalesce(current_setting('questlist.automation_depth', true), '') not in ('', '0') then
    return;
  end if;
  if p_day < v_today - 1 or p_day > v_today
     or (select gamification_enabled from public.profiles where id = p_user) is false then
    return;
  end if;
  select count(distinct card_id) into v_cards from public.card_reviews
  where user_id = p_user and day = p_day;
  -- Um lote (revisões feitas sem internet que sobem juntas) pode passar de mais de uma sessão de
  -- uma vez: dá as que faltam, até o teto. As já dadas têm o mesmo id e são ignoradas
  for v_session in 1 .. least(v_cards / v_size, v_cap) loop
    exit when (select count(*) from public.xp_events
               where user_id = p_user and kind = 'study' and not reverted and day = v_today) >= v_cap;
    select event_id into v_event
    from public._grant_event(p_user, 'study', (v_rules #>> '{xp,study}')::integer, false,
                             null, null, null, 'study:' || p_day::text || ':' || v_session, 0, false, 0,
                             md5('study:' || p_user::text || ':' || p_day::text || ':' || v_session)::uuid);
    v_granted := v_granted or v_event is not null;
  end loop;
  if v_granted then
    perform public._refresh_profile_stats(p_user);
  end if;
end;
$$;
revoke execute on function public._study_session(uuid, date) from public, anon, authenticated;

create function public.card_reviews_study()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._study_session(new.user_id, new.day);
  return null;
end;
$$;
create trigger card_reviews_study after insert on public.card_reviews
  for each row execute function public.card_reviews_study();

create or replace function public.streak_stats(
  p_user uuid, p_today date,
  out current_streak integer, out best_streak integer, out freeze_available boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days date[];
  v_d date;
  v_used text[] := '{}';
begin
  current_streak := 0;
  best_streak := 0;
  select array_agg(distinct e.day order by e.day) into v_days
  from public.xp_events e
  where e.user_id = p_user and not e.reverted
    and e.kind in ('task', 'too_fast', 'habit_plus', 'study', 'reading') and e.day <= p_today;

  if v_days is not null then
    v_d := v_days[1];
    while v_d <= p_today loop
      if v_d = any (v_days) then
        current_streak := current_streak + 1;
      elsif v_d = p_today then
        null;
      elsif current_streak > 0
            and not (to_char(v_d, 'IYYY-IW') = any (v_used))
            and ((v_d + 1) = any (v_days) or v_d + 1 = p_today) then
        v_used := array_append(v_used, to_char(v_d, 'IYYY-IW'));
      else
        current_streak := 0;
      end if;
      best_streak := greatest(best_streak, current_streak);
      v_d := v_d + 1;
    end loop;
  end if;
  freeze_available := not (to_char(p_today, 'IYYY-IW') = any (v_used));
end;
$$;

-- Dia ativo: inclui o estudo
CREATE OR REPLACE FUNCTION public._refresh_profile_stats(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_xp integer;
  v_streak record;
  v_level_before integer;
  v_level integer;
begin
  -- XP desde o último recomeço (morte) ou renascimento, com o bônus de quem renasceu (R1)
  select round(coalesce(sum(e.amount), 0) * (1 + public.rebirth_bonus(max(p.rebirths))))::integer into v_xp
  from public.profiles p
  left join public.xp_events e
    on e.user_id = p.id and not e.reverted
   and e.created_at >= greatest(coalesce(p.died_at, '-infinity'), coalesce(p.reborn_at, '-infinity'))
  where p.id = p_user;
  select level into v_level_before from public.profiles where id = p_user;
  v_level := (public.level_for_xp(v_xp)).level;
  select * into v_streak from public.streak_stats(p_user, public.user_today(p_user));
  update public.profiles
  set xp = v_xp,
      level = v_level,
      -- Subiu de nível: vida cheia (como no Habitica)
      hp = case when v_level > coalesce(v_level_before, v_level) then (public.xp_rules() #>> '{game,maxHp}')::integer else hp end,
      coins = public.gold_balance(p_user),
      streak = v_streak.current_streak,
      streak_best = v_streak.best_streak,
      last_active_date = (select max(day) from public.xp_events
                          where user_id = p_user and not reverted and kind in ('task', 'too_fast', 'habit_plus', 'study', 'reading'))
  where id = p_user;
end;
$function$

;

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
    -- ESCOPO_V8: modo Completo
    'mode', v_profile.game_mode,
    'hp', v_profile.hp,
    'max_hp', (public.xp_rules() #>> '{game,maxHp}')::integer,
    'mp', v_profile.mp,
    'max_mp', public._max_mp(v_user),
    'dead', v_profile.dead,
    'resting', v_profile.resting,
    'stealth', v_profile.stealth,
    'shield', v_profile.shield,
    'buff', case when v_profile.buff_day is not distinct from v_today then v_profile.buff_amount else 0 end,
    'avatar', v_profile.avatar,
    'costume', v_profile.costume,
    'use_costume', v_profile.use_costume,
    'active_pet', v_profile.active_pet,
    'active_mount', v_profile.active_mount,
    'vocab', v_profile.game_vocab,
    'quests', coalesce((select jsonb_agg(public._boss_json(q) || jsonb_build_object('quest_key', q.quest_key, 'quest_clan', q.quest_clan))
                        from public._active_quests(v_user) q), '[]'),
    'xp', v_profile.xp,
    'level', v_level.level,
    'rebirths', v_profile.rebirths,
    'into_level', v_level.into_level,
    'for_next', v_level.for_next,
    'streak', v_streak.current_streak,
    'streak_best', v_streak.best_streak,
    'freeze_available', v_streak.freeze_available,
    'active_today', exists (select 1 from public.xp_events where user_id = v_user and day = v_today
                            and not reverted and kind in ('task', 'too_fast', 'habit_plus', 'study', 'reading')),
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

CREATE OR REPLACE FUNCTION public._timer_finished(p_timer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Leitura de estudo (ET2): o foco ligado a uma tarefa de projeto de estudo conta para a sequência.
  -- Não vale XP (o pomodoro acima já deu); id tirado do timer, então não se repete
  if v_entry is not null and p_timer.kind = 'pomodoro' and p_timer.task_id is not null
     and v_minutes >= (v_rules #>> '{antiFarm,pomodoroMinMinutes}')::integer
     and coalesce(current_setting('questlist.automation_depth', true), '') in ('', '0')
     and exists (select 1 from public.tasks t
                 join public.folders f on f.id = public.folder_root(t.folder_id)
                 where t.id = p_timer.task_id and f.study) then
    perform public._grant_event(p_timer.user_id, 'reading', 0, false,
                                p_timer.task_id, null, null, null, 0, false, 0,
                                md5('reading:' || p_timer.id::text)::uuid);
    perform public._refresh_profile_stats(p_timer.user_id);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_time_entry(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform public._revert_xp(array[v_entry.timer_id, md5('reading:' || v_entry.timer_id::text)::uuid]);
    perform public._refresh_profile_stats(auth.uid());
  end if;
end;
$function$;
