-- V4 §1.4 (R1): renascer. A partir do nível 20 o personagem volta ao nível 1 (o XP passa a contar
-- de `reborn_at`, como a morte conta de `died_at`) e os bosses solo (diário e semanal) voltam à
-- dificuldade inicial a partir do próximo período. Fica tudo o mais: ouro, itens, mascotes,
-- conquistas, atributos e histórico. Cada renascimento dá +5% de XP permanente, até +25%
-- (V4-2, valores provisórios em xp_rules -> rebirth). Morrer depois de renascer não tira o bônus.

alter table public.profiles
  add column rebirths integer not null default 0 check (rebirths >= 0),
  add column reborn_at timestamptz;

-- Registro de cada renascimento (auditoria; o perfil guarda só o contador)
create table public.rebirth_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  n integer not null,
  level integer not null,
  xp integer not null,
  created_at timestamptz not null default clock_timestamp()
);
create index rebirth_log_user_idx on public.rebirth_log (user_id);
alter table public.rebirth_log enable row level security;
revoke all on public.rebirth_log from anon, authenticated;
grant select on public.rebirth_log to authenticated;
create policy "rebirth_log_select" on public.rebirth_log for select to authenticated
  using (user_id = (select auth.uid()));

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
    "pomodoro": 5
  },
  "antiFarm": {
    "tooFastSeconds": 30,
    "quickSeconds": 300,
    "dailyQuickCap": 50,
    "dailyQuickDamageCap": 50,
    "habitPlusDailyCap": 10,
    "pomodoroDailyCap": 4,
    "pomodoroMinMinutes": 15
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


-- Bônus de XP por renascimentos (espelho: rebirthBonus em lib/gamification.ts).
create function public.rebirth_bonus(p_rebirths integer)
returns numeric
language sql immutable set search_path = ''
as $$
  select least(greatest(coalesce(p_rebirths, 0), 0) * (public.xp_rules() #>> '{rebirth,bonusPerRebirth}')::numeric,
               (public.xp_rules() #>> '{rebirth,maxBonus}')::numeric);
$$;

create or replace function public._refresh_profile_stats(p_user uuid)
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
                          where user_id = p_user and not reverted and kind in ('task', 'too_fast', 'habit_plus'))
  where id = p_user;
end;
$function$;

create or replace function public.ensure_daily_boss(p_user uuid)
 RETURNS bosses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Renascer (R1) volta a dificuldade ao início: contam só os derrotados depois dele
  v_level := 1 + (select count(*) from public.bosses where scope = 'daily' and scope_id = p_user and status = 'defeated'
                  and created_at >= coalesce((select reborn_at from public.profiles where id = p_user), '-infinity'));
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
$function$;

create or replace function public.ensure_weekly_boss(p_user uuid)
 RETURNS bosses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tz text;
  v_key text;
  v_week_start date;
  v_boss public.bosses;
  v_rules jsonb := public.xp_rules() -> 'boss';
  v_level integer;
  v_recent numeric;
  v_hp integer;
  v_names text[] := array['Procrastinossauro', 'Hidra das Pendências', 'Golem da Bagunça',
                          'Dragão do Adiamento', 'Kraken das Notificações', 'Lich do Sofá', 'Quimera do Depois'];
  v_icons text[] := array['🦖', '🐍', '🗿', '🐉', '🐙', '💀', '🦁'];
  v_pick integer;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  if v_tz is null then
    return null;
  end if;
  v_key := to_char(now() at time zone v_tz, 'IYYY-"W"IW');
  select * into v_boss from public.bosses
  where scope = 'user' and scope_id = p_user and period_key = v_key;
  if v_boss.id is not null then
    return v_boss;
  end if;

  update public.bosses set status = 'escaped'
  where scope = 'user' and scope_id = p_user and status = 'active';

  -- Renascer (R1) volta a dificuldade ao início: contam só os derrotados depois dele
  v_level := 1 + (select count(*) from public.bosses where scope = 'user' and scope_id = p_user and status = 'defeated'
                  and created_at >= coalesce((select reborn_at from public.profiles where id = p_user), '-infinity'));
  v_week_start := date_trunc('week', now() at time zone v_tz)::date;
  select coalesce(sum(damage), 0)::numeric / (v_rules ->> 'recentWeeks')::integer into v_recent
  from public.xp_events
  where user_id = p_user and not reverted
    and day >= v_week_start - 7 * (v_rules ->> 'recentWeeks')::integer and day < v_week_start;
  v_hp := greatest(public.boss_hp_for_level(v_level), round(v_recent * (v_rules ->> 'recentFactor')::numeric)::integer);
  v_pick := (extract(week from v_week_start)::integer % cardinality(v_names)) + 1;

  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, level, starts_at, ends_at)
  values ('user', p_user, v_names[v_pick], v_icons[v_pick], v_key, v_hp, v_hp, v_level,
          v_week_start::timestamp at time zone v_tz, (v_week_start + 7)::timestamp at time zone v_tz)
  on conflict (scope, scope_id, period_key) do nothing
  returning * into v_boss;
  if v_boss.id is null then
    select * into v_boss from public.bosses where scope = 'user' and scope_id = p_user and period_key = v_key;
  end if;
  return v_boss;
end;
$function$;

create or replace function public._achievement_progress(p_user uuid)
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
      group by m.team_id) s), 0)
  );
end;
$function$;

create or replace function public.game_state()
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

create function public.rebirth()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_min integer := (public.xp_rules() #>> '{rebirth,minLevel}')::integer;
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = v_user for update;
  if v_profile.id is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not v_profile.gamification_enabled then
    raise exception 'A gamificação está desligada' using errcode = '22023';
  end if;
  if v_profile.dead then
    raise exception 'Personagem morto não renasce: volte à vida primeiro' using errcode = '22023';
  end if;
  if v_profile.level < v_min then
    raise exception 'Renascer pede o nível %', v_min using errcode = '22023';
  end if;
  insert into public.rebirth_log (user_id, n, level, xp)
  values (v_user, v_profile.rebirths + 1, v_profile.level, v_profile.xp);
  update public.profiles set rebirths = rebirths + 1, reborn_at = clock_timestamp() where id = v_user;
  perform public._refresh_profile_stats(v_user);
  v_new := public._check_achievements(v_user);
  return jsonb_build_object(
    'rebirths', v_profile.rebirths + 1,
    'bonus', public.rebirth_bonus(v_profile.rebirths + 1),
    'achievements', v_new
  );
end;
$$;
revoke execute on function public.rebirth() from public, anon;
grant execute on function public.rebirth() to authenticated;

insert into public.achievements (key, name, description, icon, position, rarity, category, series, goal, secret) values
  ('rebirth_1', 'Renascido', 'Renascer pela primeira vez', '🔥', 200, 'rare', 'levels', 'rebirths', 1, false),
  ('rebirth_3', 'Fênix', 'Renascer 3 vezes', '🐦‍🔥', 201, 'epic', 'levels', 'rebirths', 3, false),
  ('rebirth_5', 'Eterno', 'Renascer 5 vezes', '♾️', 202, 'legendary', 'levels', 'rebirths', 5, false);
