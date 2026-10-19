-- ESCOPO_V8 (HB5 a HB11, D199 a D205): modo jogo Completo. Vida, diárias e morte; mana e
-- habilidades; recompensas e baú; mascotes e montarias; missões; avatar; vocabulário.
-- Regras em public.xp_rules() -> 'game' (espelho: src/lib/gamification.config.ts).

create or replace function public.xp_rules()
returns jsonb
language sql immutable set search_path = ''
as $$
  select $json${
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
$$;

-- Perfil do jogo
alter table public.profiles
  add column hp integer not null default 50 check (hp >= 0),
  add column mp integer not null default 30 check (mp >= 0),
  -- Última virada do dia processada (null: ainda não começou a contar)
  add column hp_day date,
  -- Morreu e ainda não escolheu (comprar vida ou recomeçar)
  add column dead boolean not null default false,
  -- Recomeçou do nível 1: XP e ouro contam só do que veio depois (D197)
  add column died_at timestamptz,
  add column resting boolean not null default false,
  add column stealth integer not null default 0 check (stealth >= 0),
  add column shield boolean not null default false,
  add column buff_day date,
  add column buff_amount integer not null default 0,
  add column avatar jsonb not null default '{}',
  add column costume jsonb not null default '{}',
  add column use_costume boolean not null default false,
  add column active_pet text,
  add column active_mount text,
  add column game_vocab boolean not null default true;
grant update (resting, use_costume, game_vocab) on public.profiles to authenticated;

-- Ouro gasto fora da loja de itens (recompensas, baú, vida, poção, pergaminho)
create table public.gold_spends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  kind text not null check (kind in ('reward', 'armoire', 'life', 'potion', 'scroll')),
  ref text,
  -- Relógio real (não o início da transação): fica antes ou depois do recomeço mesmo na mesma transação
  created_at timestamptz not null default clock_timestamp()
);
create index gold_spends_user_idx on public.gold_spends (user_id, created_at);
alter table public.gold_spends enable row level security;
revoke all on public.gold_spends from anon, authenticated;
grant select on public.gold_spends to authenticated;
create policy "gold_spends_select_own" on public.gold_spends for select to authenticated using (user_id = auth.uid());

-- Eventos de habilidade (dano e ouro) entram no ledger
alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in (
  'task', 'too_fast', 'page_bonus', 'boss_reward', 'habit_plus', 'habit_minus', 'pomodoro', 'skill'));

create or replace function public.gold_balance(p_user uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  -- Depois de recomeçar (died_at), só conta o que veio depois
  with p as (select coalesce(died_at, '-infinity'::timestamptz) as since from public.profiles where id = p_user)
  select coalesce((select sum(gold) from public.xp_events, p where user_id = p_user and not reverted
                     and created_at >= p.since), 0)::integer
       - coalesce((select sum(price) from public.user_items where user_id = p_user), 0)::integer
       - coalesce((select sum(amount) from public.gold_spends, p where user_id = p_user
                     and created_at >= p.since), 0)::integer;
$$;

create function public._max_mp(p_user uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select (public.xp_rules() #>> '{game,baseMp}')::integer
         + (public.xp_rules() #>> '{game,mpPerInt}')::integer * (public.character_attributes(p_user)).intel;
$$;

-- No Completo, ligado e vivo: só aí vida, mana e drops agem
create function public._full_game(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select gamification_enabled and game_mode = 'full' and not dead
                   from public.profiles where id = p_user), false);
$$;

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
  select coalesce(sum(e.amount), 0) into v_xp from public.xp_events e, public.profiles p
  where e.user_id = p_user and not e.reverted and p.id = p_user and e.created_at >= coalesce(p.died_at, '-infinity');
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

create or replace function public.character_attributes(
  p_user uuid, out str integer, out agi integer, out intel integer, out con integer
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p public.profiles;
  v_rules jsonb := public.xp_rules();
  v_base integer := (v_rules #>> '{attributes,base}')::integer;
  v_class jsonb;
  v_buff integer := 0;
  v_gear jsonb := '{}';
begin
  select * into v_p from public.profiles where id = p_user;
  v_class := coalesce(v_rules -> 'classes' -> v_p.class, '{}');
  -- HB10: cada item equipado (batalha) dá + pela raridade no atributo do espaço
  select coalesce(jsonb_object_agg(attr, total), '{}') into v_gear from (
    select v_rules #>> array['game', 'slotAttribute', e.key] as attr,
           sum((v_rules #>> array['game', 'rarityBonus', i.rarity])::integer) as total
    from jsonb_each_text(coalesce(v_p.equipped, '{}')) e
    join public.items i on i.key = e.value
    where exists (select 1 from public.user_items u where u.user_id = p_user and u.item_key = e.value)
    group by 1) g;
  -- HB6: dia perfeito
  if v_p.buff_day is not distinct from public.user_today(p_user) then
    v_buff := v_p.buff_amount;
  end if;
  str := v_base + coalesce((v_class ->> 'str')::integer, 0) + coalesce(v_p.attr_str, 0) + coalesce((v_gear ->> 'str')::integer, 0) + v_buff;
  agi := v_base + coalesce((v_class ->> 'agi')::integer, 0) + coalesce(v_p.attr_agi, 0) + coalesce((v_gear ->> 'agi')::integer, 0) + v_buff;
  intel := v_base + coalesce((v_class ->> 'int')::integer, 0) + coalesce(v_p.attr_int, 0) + coalesce((v_gear ->> 'int')::integer, 0) + v_buff;
  con := v_base + coalesce((v_class ->> 'con')::integer, 0) + coalesce(v_p.attr_con, 0) + coalesce((v_gear ->> 'con')::integer, 0) + v_buff;
end;
$$;

-- HB5: diárias de um dia. Recorrente pessoal ainda aberta com vencimento até o dia, ou hábito de
-- marcar (diário ou nos dias da semana) sem conclusão no dia. Projeto não conta (como no Habitica).
create function public._missed_dailies(p_user uuid, p_day date)
returns table (task_id uuid, title text, priority integer)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.title, t.priority
  from public.tasks t
  join public.pages pg on pg.id = t.page_id
  join public.folders r on r.id = public.folder_root(t.folder_id)
  where r.owner_id = p_user and not r.is_shared and r.kind <> 'project'
    and t.parent_task_id is null
    and (
      (pg.view_type <> 'habits' and t.recurrence is not null and t.status <> 'done' and t.due_date <= p_day)
      or (pg.view_type = 'habits' and t.habit_kind = 'check'
          and (t.recurrence is null or t.recurrence ->> 'type' = 'daily'
               or (t.recurrence ->> 'type' = 'weekdays'
                   and (t.recurrence -> 'days') @> to_jsonb(extract(dow from p_day)::integer)))
          and t.created_at::date <= p_day
          and not exists (select 1 from public.task_completions c join public.profiles pr on pr.id = p_user
                          where c.task_id = t.id
                            and (c.completed_at at time zone coalesce(pr.timezone, 'America/Sao_Paulo'))::date = p_day))
    )
  order by t.priority desc, t.title;
$$;

-- O que a virada vai cobrar: a lista de ontem (para "o que você fez ontem?"); vazio se não há o que fazer
create function public.day_start_preview()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_p public.profiles;
  v_today date;
begin
  select * into v_p from public.profiles where id = v_user;
  v_today := public.user_today(v_user);
  if not public._full_game(v_user) or v_p.hp_day is not distinct from v_today then
    return jsonb_build_object('pending', false, 'items', '[]'::jsonb);
  end if;
  if v_p.hp_day is null then
    -- Primeira vez no Completo: começa a contar a partir de hoje
    update public.profiles set hp_day = v_today where id = v_user;
    return jsonb_build_object('pending', false, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object('pending', true, 'resting', v_p.resting, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.task_id, 'title', m.title, 'priority', m.priority))
    from public._missed_dailies(v_user, v_today - 1) m), '[]'::jsonb));
end;
$$;

-- A virada: as diárias perdidas (menos as marcadas em "fiz ontem") tiram vida; mana, dia perfeito
create function public.day_start(p_did uuid[] default '{}')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_p public.profiles;
  v_today date;
  v_con integer;
  v_factor numeric;
  v_missed record;
  v_damage numeric := 0;
  v_count integer := 0;
  v_due integer;
  v_skip integer;
  v_hit integer := 0;
  v_max_mp integer;
  v_mp integer := 0;
  v_perfect boolean := false;
begin
  select * into v_p from public.profiles where id = v_user for update;
  v_today := public.user_today(v_user);
  if not public._full_game(v_user) or v_p.hp_day is null or v_p.hp_day >= v_today then
    return jsonb_build_object('applied', false);
  end if;
  v_con := (public.character_attributes(v_user)).con;
  v_factor := greatest((v_rules ->> 'conReduceMin')::numeric, 1 - v_con * (v_rules ->> 'conReducePer')::numeric);
  v_skip := v_p.stealth;
  select count(*) into v_due from public._missed_dailies(v_user, v_today - 1);
  for v_missed in
    select m.* from public._missed_dailies(v_user, v_today - 1) m
    where not (m.task_id = any (coalesce(p_did, '{}')))
    order by m.priority desc
  loop
    v_count := v_count + 1;
    -- Furtividade evita as primeiras (as de prioridade maior)
    if v_skip > 0 then
      v_skip := v_skip - 1;
      continue;
    end if;
    v_damage := v_damage + greatest(1, (v_rules ->> 'dailyDamage')::numeric
      * (v_rules -> 'priorityWeight' ->> least(3, greatest(0, v_missed.priority)))::numeric * v_factor);
  end loop;
  if v_p.shield then
    v_damage := v_damage * (v_rules ->> 'shieldFactor')::numeric;
  end if;
  if v_p.resting then
    v_damage := 0;
  end if;
  v_hit := ceil(v_damage)::integer;

  -- Dia perfeito: havia diária e nenhuma ficou para trás
  v_perfect := v_count = 0 and exists (
    select 1 from public.tasks t join public.folders r on r.id = public.folder_root(t.folder_id)
    join public.pages pg on pg.id = t.page_id
    where r.owner_id = v_user and not r.is_shared and r.kind <> 'project'
      and (t.recurrence is not null or (pg.view_type = 'habits' and t.habit_kind = 'check')));

  v_max_mp := public._max_mp(v_user);
  if not v_p.resting then
    v_mp := ceil(greatest((v_rules ->> 'mpRegenMin')::numeric, (v_rules ->> 'mpRegenPct')::numeric * v_max_mp)
                 * case when v_due = 0 then 1 else (v_due - v_count)::numeric / v_due end)::integer;
  end if;

  update public.profiles
  set hp = greatest(0, hp - v_hit),
      mp = least(v_max_mp, mp + v_mp),
      dead = hp - v_hit <= 0,
      hp_day = v_today,
      stealth = v_skip,
      shield = false,
      buff_day = case when v_perfect then v_today else buff_day end,
      buff_amount = case when v_perfect
        then ceil(level::numeric / (v_rules ->> 'perfectDayDivisor')::integer)::integer else buff_amount end
  where id = v_user
  returning * into v_p;

  return jsonb_build_object('applied', true, 'damage', v_hit, 'missed', v_count, 'hp', v_p.hp,
                            'dead', v_p.dead, 'mp_gain', v_mp, 'perfect', v_perfect, 'resting', v_p.resting,
                            'buff', case when v_perfect then v_p.buff_amount else 0 end);
end;
$$;

-- Morte (D197): comprar uma vida (500 de ouro, mantém tudo) ou recomeçar do nível 1, sem nada
create function public.revive(p_buy boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_price integer := (v_rules ->> 'revivePrice')::integer;
begin
  if not exists (select 1 from public.profiles where id = v_user and dead) then
    raise exception 'Você não está morto' using errcode = '22023';
  end if;
  if p_buy then
    if public.gold_balance(v_user) < v_price then
      raise exception 'Ouro insuficiente' using errcode = '22023';
    end if;
    insert into public.gold_spends (user_id, amount, kind) values (v_user, v_price, 'life');
    update public.profiles set dead = false, hp = (v_rules ->> 'maxHp')::integer where id = v_user;
  else
    delete from public.user_items where user_id = v_user;
    delete from public.user_stacks where user_id = v_user;
    delete from public.user_pets where user_id = v_user;
    delete from public.user_mounts where user_id = v_user;
    update public.profiles
    set dead = false, died_at = clock_timestamp(), hp = (v_rules ->> 'maxHp')::integer, mp = (v_rules ->> 'baseMp')::integer,
        attr_str = 0, attr_agi = 0, attr_int = 0, attr_con = 0, equipped = '{}', costume = '{}',
        active_pet = null, active_mount = null, skill_day = null, stealth = 0, shield = false,
        buff_day = null, buff_amount = 0
    where id = v_user;
  end if;
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user));
end;
$$;

-- Poção de vida (antes de morrer)
create function public.buy_potion()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
begin
  if exists (select 1 from public.profiles where id = v_user and dead) then
    raise exception 'Morto não bebe poção' using errcode = '22023';
  end if;
  if public.gold_balance(v_user) < (v_rules ->> 'potionPrice')::integer then
    raise exception 'Ouro insuficiente' using errcode = '22023';
  end if;
  insert into public.gold_spends (user_id, amount, kind) values (v_user, (v_rules ->> 'potionPrice')::integer, 'potion');
  update public.profiles set hp = least((v_rules ->> 'maxHp')::integer, hp + (v_rules ->> 'potionHeal')::integer)
  where id = v_user;
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user));
end;
$$;

-- HB7: recompensas da vida real, com preço em ouro (valem no Leve também)
create table public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  cost integer not null check (cost between 1 and 100000),
  icon text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index user_rewards_user_idx on public.user_rewards (user_id);
alter table public.user_rewards enable row level security;
revoke all on public.user_rewards from anon, authenticated;
grant select, delete on public.user_rewards to authenticated;
grant insert (id, title, cost, icon, position), update (title, cost, icon, position) on public.user_rewards to authenticated;
create policy "user_rewards_own" on public.user_rewards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.redeem_reward(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.user_rewards;
begin
  select * into v_reward from public.user_rewards where id = p_id and user_id = v_user;
  if v_reward.id is null then
    raise exception 'Recompensa não encontrada' using errcode = 'P0002';
  end if;
  if public.gold_balance(v_user) < v_reward.cost then
    raise exception 'Ouro insuficiente' using errcode = '22023';
  end if;
  insert into public.gold_spends (user_id, amount, kind, ref) values (v_user, v_reward.cost, 'reward', v_reward.title);
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user));
end;
$$;

-- HB8: inventário de consumíveis, mascotes e montarias
create table public.user_stacks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('egg', 'potion', 'food', 'scroll')),
  key text not null,
  qty integer not null check (qty > 0),
  primary key (user_id, kind, key)
);
create table public.user_pets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  species text not null,
  potion text not null,
  fed integer not null default 0,
  hatched_at timestamptz not null default now(),
  primary key (user_id, species, potion)
);
create table public.user_mounts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  species text not null,
  potion text not null,
  tamed_at timestamptz not null default now(),
  primary key (user_id, species, potion)
);
-- O que caiu (para o aviso mostrar e para o teto do dia)
create table public.loot_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  key text not null,
  day date not null,
  created_at timestamptz not null default now()
);
create index loot_log_user_day_idx on public.loot_log (user_id, day);
alter table public.user_stacks enable row level security;
alter table public.user_pets enable row level security;
alter table public.user_mounts enable row level security;
alter table public.loot_log enable row level security;
revoke all on public.user_stacks, public.user_pets, public.user_mounts, public.loot_log from anon, authenticated;
grant select on public.user_stacks, public.user_pets, public.user_mounts, public.loot_log to authenticated;
create policy "user_stacks_own" on public.user_stacks for select to authenticated using (user_id = auth.uid());
create policy "user_pets_own" on public.user_pets for select to authenticated using (user_id = auth.uid());
create policy "user_mounts_own" on public.user_mounts for select to authenticated using (user_id = auth.uid());
create policy "loot_log_own" on public.loot_log for select to authenticated using (user_id = auth.uid());

create function public._add_stack(p_user uuid, p_kind text, p_key text, p_qty integer default 1)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.user_stacks (user_id, kind, key, qty) values (p_user, p_kind, p_key, p_qty)
  on conflict (user_id, kind, key) do update set qty = public.user_stacks.qty + excluded.qty;
$$;

create function public._take_stack(p_user uuid, p_kind text, p_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.user_stacks set qty = qty - 1 where user_id = p_user and kind = p_kind and key = p_key and qty > 1;
  if found then
    return true;
  end if;
  delete from public.user_stacks where user_id = p_user and kind = p_kind and key = p_key and qty = 1;
  return found;
end;
$$;

create function public._random_of(p_list jsonb)
returns text
language sql volatile set search_path = ''
as $$
  select p_list ->> floor(random() * jsonb_array_length(p_list))::integer;
$$;

-- Toda tarefa ou "+" com XP: +1 de mana e chance de drop (só no Completo)
create function public._game_on_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_rules jsonb := public.xp_rules() -> 'game';
  v_roll numeric;
  v_kind text;
  v_key text;
begin
  if new.kind not in ('task', 'habit_plus') or new.amount <= 0 or not public._full_game(new.user_id) then
    return null;
  end if;
  update public.profiles set mp = least(public._max_mp(new.user_id), mp + (v_rules ->> 'mpPerTask')::integer)
  where id = new.user_id;
  if random() >= (v_rules ->> 'dropChance')::numeric
     or (select count(*) from public.loot_log where user_id = new.user_id and day = new.day)
        >= (v_rules ->> 'dropDailyCap')::integer then
    return null;
  end if;
  v_roll := random();
  if v_roll < (v_rules ->> 'scrollDropShare')::numeric then
    v_kind := 'scroll';
    v_key := public._random_of((select jsonb_agg(q -> 'key') from jsonb_array_elements(v_rules -> 'quests') q));
  elsif v_roll < 0.35 then
    v_kind := 'egg';
    v_key := public._random_of(v_rules #> '{pets,species}');
  elsif v_roll < 0.65 then
    v_kind := 'potion';
    v_key := public._random_of(v_rules #> '{pets,potions}');
  else
    v_kind := 'food';
    v_key := public._random_of((select jsonb_agg(value) from jsonb_each(v_rules #> '{pets,foods}')));
  end if;
  perform public._add_stack(new.user_id, v_kind, v_key);
  insert into public.loot_log (user_id, kind, key, day) values (new.user_id, v_kind, v_key, new.day);
  return null;
end;
$$;
create trigger zz_game_on_event after insert on public.xp_events
  for each row execute function public._game_on_event();

create function public.hatch_pet(p_species text, p_potion text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if exists (select 1 from public.user_pets where user_id = v_user and species = p_species and potion = p_potion) then
    raise exception 'Você já tem esse mascote' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_stacks where user_id = v_user and kind = 'egg' and key = p_species)
     or not exists (select 1 from public.user_stacks where user_id = v_user and kind = 'potion' and key = p_potion) then
    raise exception 'Falta o ovo ou a poção' using errcode = '22023';
  end if;
  perform public._take_stack(v_user, 'egg', p_species);
  perform public._take_stack(v_user, 'potion', p_potion);
  insert into public.user_pets (user_id, species, potion) values (v_user, p_species, p_potion);
  update public.profiles set active_pet = coalesce(active_pet, p_species || ':' || p_potion) where id = v_user;
  return jsonb_build_object('species', p_species, 'potion', p_potion);
end;
$$;

create function public.feed_pet(p_species text, p_potion text, p_food text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_pet public.user_pets;
  v_gain integer;
begin
  select * into v_pet from public.user_pets where user_id = v_user and species = p_species and potion = p_potion for update;
  if v_pet.user_id is null then
    raise exception 'Mascote não encontrado' using errcode = 'P0002';
  end if;
  if not public._take_stack(v_user, 'food', p_food) then
    raise exception 'Falta comida' using errcode = '22023';
  end if;
  v_gain := case when v_rules #>> array['pets', 'foods', p_potion] = p_food
                 then (v_rules ->> 'feedFavorite')::integer else (v_rules ->> 'feedOther')::integer end;
  if v_pet.fed + v_gain >= (v_rules ->> 'feedToMount')::integer then
    -- Virou montaria: o mascote sai (pode chocar de novo)
    delete from public.user_pets where user_id = v_user and species = p_species and potion = p_potion;
    insert into public.user_mounts (user_id, species, potion) values (v_user, p_species, p_potion)
      on conflict do nothing;
    update public.profiles
    set active_pet = case when active_pet = p_species || ':' || p_potion then null else active_pet end,
        active_mount = coalesce(active_mount, p_species || ':' || p_potion)
    where id = v_user;
    return jsonb_build_object('mount', true, 'fed', (v_rules ->> 'feedToMount')::integer, 'favorite', v_gain > (v_rules ->> 'feedOther')::integer);
  end if;
  update public.user_pets set fed = fed + v_gain where user_id = v_user and species = p_species and potion = p_potion;
  return jsonb_build_object('mount', false, 'fed', v_pet.fed + v_gain, 'favorite', v_gain > (v_rules ->> 'feedOther')::integer);
end;
$$;

-- Mascote e montaria que aparecem com o personagem (null tira)
create function public.set_companion(p_kind text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if p_kind = 'pet' then
    if p_value is not null and not exists (select 1 from public.user_pets
        where user_id = v_user and species || ':' || potion = p_value) then
      raise exception 'Mascote não encontrado' using errcode = 'P0002';
    end if;
    update public.profiles set active_pet = p_value where id = v_user;
  elsif p_kind = 'mount' then
    if p_value is not null and not exists (select 1 from public.user_mounts
        where user_id = v_user and species || ':' || potion = p_value) then
      raise exception 'Montaria não encontrada' using errcode = 'P0002';
    end if;
    update public.profiles set active_mount = p_value where id = v_user;
  else
    raise exception 'Use pet ou mount' using errcode = '22023';
  end if;
end;
$$;

-- HB7: baú encantado. Um item da loja que você ainda não tem; sem nenhum, uma comida
create function public.open_armoire()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_price integer := (v_rules ->> 'armoirePrice')::integer;
  v_item public.items;
  v_food text;
begin
  if public.gold_balance(v_user) < v_price then
    raise exception 'Ouro insuficiente' using errcode = '22023';
  end if;
  insert into public.gold_spends (user_id, amount, kind) values (v_user, v_price, 'armoire');
  select * into v_item from public.items i
  where (i.price is not null or i.drop)
    and not exists (select 1 from public.user_items u where u.user_id = v_user and u.item_key = i.key)
  order by random() limit 1;
  if v_item.key is not null then
    insert into public.user_items (user_id, item_key, source) values (v_user, v_item.key, 'drop');
    perform public._refresh_profile_stats(v_user);
    return jsonb_build_object('gold', public.gold_balance(v_user), 'item',
      jsonb_build_object('key', v_item.key, 'name', v_item.name, 'icon', v_item.icon, 'rarity', v_item.rarity));
  end if;
  v_food := public._random_of((select jsonb_agg(value) from jsonb_each(v_rules #> '{pets,foods}')));
  perform public._add_stack(v_user, 'food', v_food);
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user), 'food', v_food);
end;
$$;

-- HB9: missões. Um boss de escopo 'quest', sozinho (scope_id = pessoa) ou do clã (scope_id = clã)
alter table public.bosses drop constraint bosses_scope_check;
alter table public.bosses add constraint bosses_scope_check check (scope in ('user', 'daily', 'folder', 'clan', 'quest'));
alter table public.bosses
  add column quest_key text,
  add column quest_clan boolean not null default false;

-- Missões ativas da pessoa (a dela e a do clã). As vencidas fogem
create function public._active_quests(p_user uuid)
returns setof public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_clan uuid := (select clan_id from public.clan_members where user_id = p_user);
begin
  update public.bosses set status = 'escaped'
  where scope = 'quest' and status = 'active' and ends_at < now()
    and (scope_id = p_user or scope_id = v_clan);
  return query select * from public.bosses
    where scope = 'quest' and status = 'active' and (scope_id = p_user or (v_clan is not null and scope_id = v_clan))
    order by created_at;
end;
$$;

create function public.buy_scroll(p_quest text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
begin
  if not exists (select 1 from jsonb_array_elements(v_rules -> 'quests') q where q ->> 'key' = p_quest) then
    raise exception 'Missão não encontrada' using errcode = 'P0002';
  end if;
  if public.gold_balance(v_user) < (v_rules ->> 'scrollPrice')::integer then
    raise exception 'Ouro insuficiente' using errcode = '22023';
  end if;
  insert into public.gold_spends (user_id, amount, kind, ref) values (v_user, (v_rules ->> 'scrollPrice')::integer, 'scroll', p_quest);
  perform public._add_stack(v_user, 'scroll', p_quest);
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user));
end;
$$;

create function public.start_quest(p_quest text, p_clan boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_quest jsonb;
  v_scope uuid;
  v_boss public.bosses;
begin
  select q into v_quest from jsonb_array_elements(v_rules -> 'quests') q where q ->> 'key' = p_quest;
  if v_quest is null then
    raise exception 'Missão não encontrada' using errcode = 'P0002';
  end if;
  v_scope := case when p_clan then (select clan_id from public.clan_members where user_id = v_user) else v_user end;
  if v_scope is null then
    raise exception 'Você não está num clã' using errcode = '22023';
  end if;
  perform public._active_quests(v_user);
  if exists (select 1 from public.bosses where scope = 'quest' and status = 'active' and scope_id = v_scope) then
    raise exception 'Já existe uma missão em andamento' using errcode = '22023';
  end if;
  if not public._take_stack(v_user, 'scroll', p_quest) then
    raise exception 'Falta o pergaminho' using errcode = '22023';
  end if;
  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, starts_at, ends_at, status, level,
                             quest_key, quest_clan)
  values ('quest', v_scope, v_quest ->> 'name', '📜', 'q:' || p_quest || ':' || extract(epoch from clock_timestamp()),
          (v_quest ->> 'hp')::integer, (v_quest ->> 'hp')::integer, now(),
          now() + make_interval(days => (v_rules ->> 'questDays')::integer), 'active', 1, p_quest, p_clan)
  returning * into v_boss;
  if p_clan then
    perform public._clan_log(v_scope, v_user, 'quest_started', jsonb_build_object('name', v_boss.name));
  end if;
  return public._boss_json(v_boss);
end;
$$;

-- HB6: habilidades de mana (o catálogo está no xp_rules)
create function public.cast_mana_skill(p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules() -> 'game';
  v_p public.profiles;
  v_skill jsonb;
  v_power integer;
  v_damage integer := 0;
  v_gold integer := 0;
  v_grant record;
  v_result jsonb := '{}';
begin
  select * into v_p from public.profiles where id = v_user for update;
  if not public._full_game(v_user) then
    raise exception 'Habilidades de mana são do modo Completo' using errcode = '22023';
  end if;
  select s into v_skill from jsonb_array_elements(v_rules -> 'manaSkills' -> v_p.class) s where s ->> 'key' = p_key;
  if v_skill is null then
    raise exception 'Habilidade não encontrada' using errcode = 'P0002';
  end if;
  if v_p.level < (v_skill ->> 'level')::integer then
    raise exception 'Nível insuficiente' using errcode = '22023';
  end if;
  if v_p.mp < (v_skill ->> 'mana')::integer then
    raise exception 'Mana insuficiente' using errcode = '22023';
  end if;
  update public.profiles set mp = mp - (v_skill ->> 'mana')::integer where id = v_user;
  v_power := (v_skill ->> 'power')::integer;
  case v_skill ->> 'effect'
    when 'strike' then
      v_damage := v_power + (public.character_attributes(v_user)).str;
    when 'gold' then
      v_gold := v_power;
    when 'heal' then
      update public.profiles set hp = least((v_rules ->> 'maxHp')::integer, hp + v_power) where id = v_user;
    when 'healClan' then
      update public.profiles set hp = least((v_rules ->> 'maxHp')::integer, hp + v_power)
      where not dead and (id = v_user or id in (select m.user_id from public.clan_members m
        where m.clan_id = (select clan_id from public.clan_members where user_id = v_user)));
    when 'shield' then
      update public.profiles set shield = true where id = v_user;
    when 'stealth' then
      update public.profiles set stealth = stealth + v_power where id = v_user;
  end case;
  if v_damage > 0 or v_gold > 0 then
    select * into v_grant from public._grant_event(v_user, 'skill', 0, false, null, null, null,
                                                   's:' || gen_random_uuid(), v_damage, false, v_gold);
    v_result := public._game_summary(v_user, v_p.level, 0, coalesce(v_grant.boss_defeated, false));
  else
    perform public._refresh_profile_stats(v_user);
  end if;
  return v_result || jsonb_build_object('skill', p_key, 'damage', v_damage, 'gold', v_gold);
end;
$$;

-- HB10: aparência (retrato da classe e cenário) e fantasia
create function public.set_appearance(p_portrait text, p_background text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rules jsonb := public.xp_rules() -> 'game';
begin
  if p_portrait is not null and not (v_rules -> 'portraits') ? p_portrait then
    raise exception 'Retrato não encontrado' using errcode = '22023';
  end if;
  if p_background is not null and not (v_rules -> 'backgrounds') ? p_background then
    raise exception 'Cenário não encontrado' using errcode = '22023';
  end if;
  update public.profiles set avatar = jsonb_strip_nulls(jsonb_build_object('portrait', p_portrait, 'background', p_background))
  where id = auth.uid();
end;
$$;

create function public.equip_costume(p_slot text, p_item text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if p_item is null then
    update public.profiles set costume = costume - p_slot where id = v_user;
    return;
  end if;
  if not exists (select 1 from public.user_items u join public.items i on i.key = u.item_key
                 where u.user_id = v_user and u.item_key = p_item and i.slot = p_slot) then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  update public.profiles set costume = costume || jsonb_build_object(p_slot, p_item) where id = v_user;
end;
$$;

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
  ] || coalesce((select array_agg(q) from public._active_quests(p_user) q), '{}') loop
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
      when 'quest' then case when not p_boss.quest_clan then array[p_boss.scope_id]
        else (select array_agg(user_id) from (
          select user_id from public.boss_damage where boss_id = p_boss.id group by user_id having sum(amount) > 0) q) end
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

CREATE OR REPLACE FUNCTION public._game_summary(p_user uuid, p_level_before integer, p_xp integer, p_boss_defeated boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_level integer;
  v_new jsonb := '[]';
begin
  if p_user is null then
    return jsonb_build_object('xp', 0, 'level', null, 'level_up', false, 'boss_defeated', false,
                              'achievements', '[]'::jsonb, 'drops', '[]'::jsonb);
  end if;
  perform public._refresh_profile_stats(p_user);
  select level into v_level from public.profiles where id = p_user;
  if p_xp > 0 or p_boss_defeated then
    v_new := public._check_achievements(p_user);
  end if;
  return jsonb_build_object('xp', p_xp, 'level', v_level, 'level_up', v_level > p_level_before,
                            'boss_defeated', p_boss_defeated, 'achievements', v_new,
    -- O3: como ficaram o diário e o semanal depois do golpe, e quem caiu agora
    'bosses', jsonb_build_object('daily', public._boss_json(public.ensure_daily_boss(p_user)),
                                 'weekly', public._boss_json(public.ensure_weekly_boss(p_user))),
    'defeated_now', (select coalesce(jsonb_agg(b.scope), '[]') from public.bosses b
                     where b.defeated_at = now() and b.status = 'defeated'
                       and ((b.scope in ('user', 'daily') and b.scope_id = p_user)
                            or (b.scope = 'clan' and b.scope_id = (select clan_id from public.clan_members where user_id = p_user))
                            or (b.scope = 'quest' and (b.scope_id = p_user
                                or b.scope_id = (select clan_id from public.clan_members where user_id = p_user))))),
    -- now() é o início da transação: o que foi ganho nesta chamada
    -- HB8: ovos, poções, comida e pergaminhos que caíram nesta chamada
    'loot', (select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'key', l.key)), '[]')
             from public.loot_log l where l.user_id = p_user and l.created_at = now()),
    'drops', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'name', i.name, 'icon', i.icon, 'rarity', i.rarity)), '[]')
              from public.user_items u join public.items i on i.key = u.item_key
              where u.user_id = p_user and u.source = 'drop' and u.acquired_at = now()));
end;
$function$;

revoke execute on function public._missed_dailies(uuid, date), public._max_mp(uuid), public._full_game(uuid),
  public._add_stack(uuid, text, text, integer), public._take_stack(uuid, text, text), public._random_of(jsonb),
  public._game_on_event(), public._active_quests(uuid) from public, anon, authenticated;
revoke execute on function public.day_start_preview(), public.day_start(uuid[]), public.revive(boolean),
  public.buy_potion(), public.redeem_reward(uuid), public.hatch_pet(text, text), public.feed_pet(text, text, text),
  public.set_companion(text, text), public.open_armoire(), public.buy_scroll(text), public.start_quest(text, boolean),
  public.cast_mana_skill(text), public.set_appearance(text, text), public.equip_costume(text, text)
  from public, anon;
grant execute on function public.day_start_preview(), public.day_start(uuid[]), public.revive(boolean),
  public.buy_potion(), public.redeem_reward(uuid), public.hatch_pet(text, text), public.feed_pet(text, text, text),
  public.set_companion(text, text), public.open_armoire(), public.buy_scroll(text), public.start_quest(text, boolean),
  public.cast_mana_skill(text), public.set_appearance(text, text), public.equip_costume(text, text)
  to authenticated;

-- O feed do clã mostra a missão começada
alter table public.clan_activity drop constraint clan_activity_action_check;
alter table public.clan_activity add constraint clan_activity_action_check
  check (action in ('joined', 'left', 'boss_defeated', 'achievement', 'quest_started'));
