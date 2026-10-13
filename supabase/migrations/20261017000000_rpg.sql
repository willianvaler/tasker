-- Fase 7: RPG leve (D60 a D67). Classe (só sabor + habilidades), atributos com pontos por nível,
-- dano ao boss separado do XP (com crítico), ouro, loja de visuais e drops de boss, níveis de boss,
-- hábitos contador (meta) e bom/ruim (+/−), e mais conquistas.
--
-- O dano agora é calculado por evento (_attack) e guardado no próprio evento do ledger
-- (xp_events.damage), assim como o ouro (xp_events.gold). Reverter o evento tira os dois.
-- Tarefa relâmpago continua valendo 0 XP, mas bate no boss (com teto diário de dano rápido).

-- ============================================================
-- Regras (espelho de src/lib/gamification.config.ts; o teste gamification.test.ts compara os dois)
-- ============================================================

create or replace function public.xp_rules()
returns jsonb
language sql immutable set search_path = ''
as $$
  select $json$
  {
    "xp": {
      "task": 10,
      "priorityMultiplier": [1, 1, 1.25, 1.5],
      "habit": 8,
      "streakBonusPerDay": 1,
      "streakBonusMax": 20,
      "checklistItem": 5,
      "pageBonus": 25,
      "pageBonusMinItems": 3,
      "habitPlus": 3
    },
    "antiFarm": {
      "tooFastSeconds": 30,
      "quickSeconds": 300,
      "dailyQuickCap": 50,
      "dailyQuickDamageCap": 20,
      "habitPlusDailyCap": 10
    },
    "level": { "base": 100, "exponent": 1.4 },
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
    "gold": { "task": 2, "habit": 1, "checklistItem": 1, "pageBonus": 5, "habitPlus": 1, "perCon": 0.03 },
    "attributes": { "base": 1, "pointsPerLevel": 1, "healReducePerCon": 0.08, "healReduceMax": 0.8 },
    "classes": {
      "lutador": { "str": 3, "agi": 0, "int": 0, "con": 1 },
      "mago": { "str": 0, "agi": 1, "int": 3, "con": 0 },
      "arqueiro": { "str": 1, "agi": 3, "int": 0, "con": 0 },
      "paladino": { "str": 0, "agi": 0, "int": 1, "con": 3 },
      "ladino": { "str": 1, "agi": 2, "int": 0, "con": 1 }
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
    "habits": { "maxTarget": 100 }
  }
  $json$::jsonb;
$$;

-- ============================================================
-- Colunas novas
-- ============================================================

-- Personagem. Nada disso é gravável pelo cliente (D7): só pelas funções abaixo.
alter table public.profiles
  add column class text check (class in ('lutador', 'mago', 'arqueiro', 'paladino', 'ladino')),
  add column attr_str smallint not null default 0 check (attr_str >= 0),
  add column attr_agi smallint not null default 0 check (attr_agi >= 0),
  add column attr_int smallint not null default 0 check (attr_int >= 0),
  add column attr_con smallint not null default 0 check (attr_con >= 0),
  -- Dia (no fuso do usuário) em que a habilidade ativa foi usada: vale até o fim dele
  add column skill_day date,
  -- {"head": "crown", "pet": "cat", ...}: só itens que a pessoa tem (game_state filtra)
  add column equipped jsonb not null default '{}';

-- Dano, crítico e ouro de cada evento (o dano bate no boss solo e no do clã)
alter table public.xp_events
  add column damage integer not null default 0,
  add column crit boolean not null default false,
  add column gold integer not null default 0 check (gold >= 0);
alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in (
  'task', 'too_fast', 'page_bonus', 'boss_reward', 'habit_plus', 'habit_minus'));

-- Hábito ruim cura o boss: o "dano" fica negativo
alter table public.boss_damage drop constraint boss_damage_amount_check;
alter table public.boss_damage add constraint boss_damage_amount_check check (amount <> 0);

alter table public.bosses add column level integer not null default 1 check (level >= 1);

-- Hábitos: marcar (padrão), contador com meta ou bom/ruim (+/−). As contagens são do período atual
-- (count_key) e só mudam por habit_tick / refresh_cycles.
alter table public.tasks
  add column habit_kind text not null default 'check' check (habit_kind in ('check', 'counter', 'plusminus')),
  add column habit_target smallint check (habit_target between 1 and 100),
  add column count_up integer not null default 0,
  add column count_down integer not null default 0,
  add column count_key text;
grant insert (habit_kind, habit_target), update (habit_kind, habit_target) on public.tasks to authenticated;

-- ============================================================
-- Itens (catálogo) e itens de cada pessoa
-- ============================================================

create table public.items (
  key text primary key,
  name text not null,
  icon text not null,
  slot text not null check (slot in ('head', 'hand', 'pet', 'aura', 'title')),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  -- null = não está à venda (só cai de boss)
  price integer check (price > 0),
  -- Pode cair de boss
  drop boolean not null default false,
  position integer not null
);

insert into public.items (key, name, icon, slot, rarity, price, drop, position) values
  -- Cabeça
  ('cap', 'Boné', '🧢', 'head', 'common', 40, false, 1),
  ('flower', 'Flor no cabelo', '🌸', 'head', 'common', 40, false, 2),
  ('grad', 'Capelo', '🎓', 'head', 'common', 60, false, 3),
  ('rescue', 'Capacete de resgate', '⛑️', 'head', 'common', 60, false, 4),
  ('tophat', 'Cartola', '🎩', 'head', 'rare', 120, true, 5),
  ('helmet', 'Elmo', '🪖', 'head', 'rare', 120, true, 6),
  ('pumpkin', 'Cabeça de abóbora', '🎃', 'head', 'epic', null, true, 7),
  ('crown', 'Coroa', '👑', 'head', 'legendary', null, true, 8),
  -- Mão
  ('hammer', 'Martelo', '🔨', 'hand', 'common', 40, false, 11),
  ('sword', 'Espada curta', '🗡️', 'hand', 'common', 50, false, 12),
  ('wand', 'Varinha', '🪄', 'hand', 'common', 50, false, 13),
  ('bow', 'Arco', '🏹', 'hand', 'common', 50, false, 14),
  ('shield', 'Escudo', '🛡️', 'hand', 'rare', 120, true, 15),
  ('axe', 'Machado', '🪓', 'hand', 'rare', 120, true, 16),
  ('orb', 'Orbe de cristal', '🔮', 'hand', 'rare', 150, true, 17),
  ('boomerang', 'Bumerangue', '🪃', 'hand', 'rare', null, true, 18),
  ('torch', 'Tocha eterna', '🔥', 'hand', 'epic', 300, true, 19),
  ('trident', 'Tridente', '🔱', 'hand', 'legendary', null, true, 20),
  -- Companheiro
  ('turtle', 'Tartaruga', '🐢', 'pet', 'common', 60, false, 21),
  ('cat', 'Gato', '🐱', 'pet', 'common', 80, false, 22),
  ('dog', 'Cachorro', '🐶', 'pet', 'common', 80, false, 23),
  ('owl', 'Coruja', '🦉', 'pet', 'rare', 150, true, 24),
  ('fox', 'Raposa', '🦊', 'pet', 'rare', 150, true, 25),
  ('octopus', 'Polvo', '🐙', 'pet', 'rare', null, true, 26),
  ('dino', 'Dinossauro', '🦖', 'pet', 'epic', null, true, 27),
  ('unicorn', 'Unicórnio', '🦄', 'pet', 'epic', null, true, 28),
  ('dragon', 'Dragão', '🐉', 'pet', 'legendary', null, true, 29),
  -- Aura (fundo do personagem)
  ('aura_sky', 'Aura do céu', '🌤️', 'aura', 'common', 60, false, 31),
  ('aura_forest', 'Aura da floresta', '🌲', 'aura', 'common', 60, false, 32),
  ('aura_sunset', 'Aura do pôr do sol', '🌇', 'aura', 'rare', 150, true, 33),
  ('aura_night', 'Aura da noite estrelada', '🌌', 'aura', 'rare', 150, true, 34),
  ('aura_gold', 'Aura dourada', '✨', 'aura', 'epic', null, true, 35),
  ('aura_void', 'Aura do vazio', '🕳️', 'aura', 'legendary', null, true, 36),
  -- Título
  ('title_foco', 'Mente Focada', '🧠', 'title', 'common', 30, false, 41),
  ('title_lista', 'Lista Zerada', '📋', 'title', 'common', 40, false, 42),
  ('title_cafe', 'Movido a Café', '☕', 'title', 'common', 40, false, 43),
  ('title_prazo', 'Terror dos Prazos', '⏰', 'title', 'rare', null, true, 44),
  ('title_lenda', 'Lenda da Semana', '🏆', 'title', 'epic', null, true, 45),
  ('title_dragao', 'Flagelo dos Dragões', '🐲', 'title', 'legendary', null, true, 46);

create table public.user_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_key text not null references public.items (key) on delete cascade,
  source text not null check (source in ('shop', 'drop')),
  -- Ouro pago (0 se veio de boss). O saldo de ouro = ouro do ledger − soma disto
  price integer not null default 0 check (price >= 0),
  -- Recompensa de boss que deu o item: se a recompensa sai (boss voltou à vida), o item sai junto
  event_id uuid references public.xp_events (id) on delete set null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
create index user_items_event_id_idx on public.user_items (event_id);

alter table public.items enable row level security;
alter table public.user_items enable row level security;
revoke all on public.items, public.user_items from anon, authenticated;
grant select on public.items, public.user_items to authenticated;
create policy "items_select" on public.items for select to authenticated using (true);
create policy "user_items_select" on public.user_items for select to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================
-- Personagem: atributos, ouro
-- ============================================================

-- Atributos totais = base + bônus da classe + pontos distribuídos
create function public.character_attributes(
  p_user uuid, out str integer, out agi integer, out intel integer, out con integer
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p public.profiles;
  v_base integer := (public.xp_rules() #>> '{attributes,base}')::integer;
  v_class jsonb;
begin
  select * into v_p from public.profiles where id = p_user;
  v_class := coalesce(public.xp_rules() -> 'classes' -> v_p.class, '{}');
  str := v_base + coalesce((v_class ->> 'str')::integer, 0) + coalesce(v_p.attr_str, 0);
  agi := v_base + coalesce((v_class ->> 'agi')::integer, 0) + coalesce(v_p.attr_agi, 0);
  intel := v_base + coalesce((v_class ->> 'int')::integer, 0) + coalesce(v_p.attr_int, 0);
  con := v_base + coalesce((v_class ->> 'con')::integer, 0) + coalesce(v_p.attr_con, 0);
end;
$$;

-- Ouro = ganho no ledger − gasto na loja (pode ficar negativo se uma recompensa for revertida)
create function public.gold_balance(p_user uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(gold) from public.xp_events where user_id = p_user and not reverted), 0)::integer
       - coalesce((select sum(price) from public.user_items where user_id = p_user), 0)::integer;
$$;

-- Pontos de atributo ainda não distribuídos (1 por nível acima do 1; nunca negativo)
create function public.attribute_points(p_user uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select greatest(0, (p.level - 1) * (public.xp_rules() #>> '{attributes,pointsPerLevel}')::integer
                     - (p.attr_str + p.attr_agi + p.attr_int + p.attr_con))
  from public.profiles p where p.id = p_user;
$$;

-- ============================================================
-- Dano (D61)
-- ============================================================

-- Um golpe: base × (1 + bônus do atributo + passiva/habilidade) × crítico. Categoria 'task' usa a Força;
-- 'routine' (hábitos, recorrentes, cards, subtarefas, hábito bom) usa a Inteligência.
create function public._attack(
  p_user uuid, p_category text, p_base numeric, p_overdue boolean,
  out damage integer, out crit boolean
)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_rules jsonb := public.xp_rules();
  v_d jsonb := v_rules -> 'damage';
  v_s jsonb := v_rules -> 'skills';
  v_p public.profiles;
  v_a record;
  v_today date;
  v_skill boolean;
  v_mult numeric;
  v_chance numeric;
begin
  crit := false;
  damage := 0;
  if p_base <= 0 then
    return;
  end if;
  select * into v_p from public.profiles where id = p_user;
  select * into v_a from public.character_attributes(p_user);
  v_today := public.user_today(p_user);
  v_skill := v_p.class is not null and v_p.skill_day is not distinct from v_today;

  v_mult := 1 + (v_d ->> 'perPoint')::numeric * (case when p_category = 'task' then v_a.str else v_a.intel end);
  -- Passiva do mago: foco pela sequência
  if v_p.class = 'mago' then
    v_mult := v_mult + least((v_s ->> 'streakFocusMax')::numeric, (v_s ->> 'streakFocusPerDay')::numeric * v_p.streak);
  end if;
  -- Habilidades ativas (valem o dia todo)
  if v_skill then
    v_mult := v_mult + case
      when v_p.class = 'lutador' and p_category = 'task' then (v_s ->> 'furyBonus')::numeric
      when v_p.class = 'mago' and p_category = 'routine' then (v_s ->> 'stormBonus')::numeric
      when v_p.class = 'paladino' then (v_s ->> 'blessingBonus')::numeric
      else 0 end;
  end if;
  -- Passiva do lutador: o primeiro golpe do dia
  if v_p.class = 'lutador' and not exists (
    select 1 from public.xp_events e where e.user_id = p_user and e.day = v_today and not e.reverted and e.damage > 0
  ) then
    v_mult := v_mult * (v_s ->> 'firstStrikeMultiplier')::numeric;
  end if;
  -- Emboscada do ladino: tarefa atrasada
  if v_skill and v_p.class = 'ladino' and p_category = 'task' and p_overdue then
    v_mult := v_mult * (v_s ->> 'ambushMultiplier')::numeric;
  end if;

  v_chance := least((v_d ->> 'critMax')::numeric,
                    (v_d ->> 'critPerAgi')::numeric * v_a.agi
                    + case when v_skill and v_p.class = 'arqueiro' then (v_s ->> 'aimCritBonus')::numeric else 0 end);
  crit := random() < v_chance;
  if crit then
    v_mult := v_mult * case when v_p.class = 'arqueiro' then (v_s ->> 'archerCritMultiplier')::numeric
                            else (v_d ->> 'critMultiplier')::numeric end;
  end if;
  damage := greatest(1, round(p_base * v_mult))::integer;
end;
$$;

-- Ouro de uma conclusão: base × (1 + Constituição) (+ passiva do ladino)
create function public._gold_for(p_user uuid, p_base integer)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_class text;
  v_con integer;
  v_mult numeric;
begin
  if p_base <= 0 then
    return 0;
  end if;
  select class into v_class from public.profiles where id = p_user;
  select con into v_con from public.character_attributes(p_user);
  v_mult := 1 + (public.xp_rules() #>> '{gold,perCon}')::numeric * v_con
          + case when v_class = 'ladino' then (public.xp_rules() #>> '{skills,rogueGoldBonus}')::numeric else 0 end;
  return round(p_base * v_mult)::integer;
end;
$$;

-- Teto diário do dano das conclusões rápidas (criada há menos de 5 min, inclusive as relâmpago)
create function public._cap_quick_damage(p_user uuid, p_damage integer)
returns integer
language sql stable security definer set search_path = ''
as $$
  select least(p_damage, greatest(0, (public.xp_rules() #>> '{antiFarm,dailyQuickDamageCap}')::integer
    - coalesce((select sum(damage) from public.xp_events where user_id = p_user and quick and not reverted
                and day = public.user_today(p_user)), 0)))::integer;
$$;

-- ============================================================
-- Bosses com nível (D62)
-- ============================================================

create function public.boss_hp_for_level(p_level integer)
returns integer
language sql immutable set search_path = ''
as $$
  select round((public.xp_rules() #>> '{boss,hpBase}')::numeric
               * power((public.xp_rules() #>> '{boss,hpGrowth}')::numeric, greatest(p_level, 1) - 1))::integer;
$$;

-- Boss solo da semana. Nível = 1 + bosses solo já derrotados. HP = HP do nível ou 80% do dano médio
-- semanal das últimas 4 semanas, o que for maior.
create or replace function public.ensure_weekly_boss(p_user uuid)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
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

  v_level := 1 + (select count(*) from public.bosses where scope = 'user' and scope_id = p_user and status = 'defeated');
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
$$;

-- Boss do clã: nível = 1 + bosses do clã derrotados; HP = HP do nível × membros ativos
create or replace function public.ensure_clan_boss(p_clan_id uuid)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_key text;
  v_week_start date;
  v_boss public.bosses;
  v_active integer;
  v_level integer;
  v_hp integer;
  v_names text[] := array['Titã da Preguiça', 'Leviatã dos Prazos', 'Colosso da Bagunça', 'Hidra das Reuniões',
                          'Dragão Ancião do Adiamento', 'Behemoth da Caixa de Entrada'];
  v_icons text[] := array['🗿', '🐋', '🏔️', '🐍', '🐲', '🦣'];
  v_pick integer;
begin
  if p_clan_id is null then
    return null;
  end if;
  select coalesce(p.timezone, 'America/Sao_Paulo') into v_tz
  from public.clans c left join public.profiles p on p.id = c.created_by where c.id = p_clan_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_key := to_char(now() at time zone v_tz, 'IYYY-"W"IW');
  select * into v_boss from public.bosses where scope = 'clan' and scope_id = p_clan_id and period_key = v_key;
  if v_boss.id is not null then
    return v_boss;
  end if;

  update public.bosses set status = 'escaped' where scope = 'clan' and scope_id = p_clan_id and status = 'active';

  select count(distinct m.user_id) into v_active
  from public.clan_members m
  where m.clan_id = p_clan_id and exists (
    select 1 from public.xp_events e where e.user_id = m.user_id and not e.reverted
      and e.kind in ('task', 'too_fast', 'habit_plus') and e.created_at > now() - interval '14 days');
  v_level := 1 + (select count(*) from public.bosses where scope = 'clan' and scope_id = p_clan_id and status = 'defeated');
  v_hp := greatest(1, v_active) * public.boss_hp_for_level(v_level);

  v_week_start := date_trunc('week', now() at time zone v_tz)::date;
  v_pick := (extract(week from v_week_start)::integer % cardinality(v_names)) + 1;
  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, level, starts_at, ends_at)
  values ('clan', p_clan_id, v_names[v_pick], v_icons[v_pick], v_key, v_hp, v_hp, v_level,
          v_week_start::timestamp at time zone v_tz, (v_week_start + 7)::timestamp at time zone v_tz)
  on conflict (scope, scope_id, period_key) do nothing
  returning * into v_boss;
  if v_boss.id is null then
    select * into v_boss from public.bosses where scope = 'clan' and scope_id = p_clan_id and period_key = v_key;
  end if;
  return v_boss;
end;
$$;

-- HP pelo dano registrado, sem passar do máximo (a cura não cria "escudo") nem de 0
create or replace function public._settle_boss(p_boss_id uuid)
returns boolean -- true = derrotado agora
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
  v_damage integer;
  v_defeated boolean := false;
begin
  select * into v_boss from public.bosses where id = p_boss_id;
  if v_boss.scope = 'folder' then
    return public._settle_project_boss(p_boss_id);
  end if;
  select * into v_boss from public.bosses where id = p_boss_id for update;
  if v_boss.id is null or v_boss.status = 'escaped' then
    return false;
  end if;
  select coalesce(sum(amount), 0) into v_damage from public.boss_damage where boss_id = p_boss_id;
  update public.bosses set hp = least(max_hp, greatest(0, max_hp - v_damage)) where id = p_boss_id returning * into v_boss;

  if v_boss.hp = 0 and v_boss.status = 'active' then
    update public.bosses set status = 'defeated', defeated_at = now() where id = p_boss_id returning * into v_boss;
    v_defeated := true;
    if v_boss.scope = 'clan' then
      perform public._clan_log(v_boss.scope_id, auth.uid(), 'boss_defeated', jsonb_build_object('name', v_boss.name));
    end if;
  elsif v_boss.hp > 0 and v_boss.status = 'defeated' then
    -- Desmarcar tirou o golpe final: o boss volta e a recompensa sai
    update public.bosses set status = 'active', defeated_at = null where id = p_boss_id returning * into v_boss;
    if v_boss.scope = 'clan' then
      delete from public.clan_activity where clan_id = v_boss.scope_id and action = 'boss_defeated'
        and payload ->> 'name' = v_boss.name and created_at >= v_boss.starts_at;
    end if;
  end if;
  perform public._sync_boss_rewards(v_boss);
  return v_defeated;
end;
$$;

-- Sorteia um item que a pessoa ainda não tem. Quanto maior o nível do boss, mais chance de raro.
create function public._roll_drop(p_user uuid, p_level integer)
returns text
language sql volatile security definer set search_path = ''
as $$
  select i.key from public.items i
  where i.drop and not exists (select 1 from public.user_items u where u.user_id = p_user and u.item_key = i.key)
  -- Amostragem ponderada: menor -ln(random) / peso
  order by -ln(1 - random()) / case i.rarity
    when 'rare' then 60
    when 'epic' then 25 + 5 * p_level
    when 'legendary' then 5 + 3 * p_level
    else 10 end
  limit 1;
$$;

-- Recompensa = quem contribuiu (com dano líquido > 0). XP, ouro pelo nível do boss e um item sorteado.
-- Dá para quem falta e tira (com o item) de quem deixou de contribuir.
create or replace function public._sync_boss_rewards(p_boss public.bosses)
returns void
language plpgsql security definer set search_path = ''
as $$
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
  v_gold := (v_rules ->> 'rewardGold')::integer + (v_rules ->> 'rewardGoldPerLevel')::integer * (p_boss.level - 1);
  foreach v_user in array v_recipients loop
    continue when exists (select 1 from public.xp_events e where e.boss_id = p_boss.id and e.user_id = v_user
                          and e.kind = 'boss_reward' and not e.reverted);
    v_item := public._roll_drop(v_user, p_boss.level);
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
$$;

-- ============================================================
-- Ledger: evento com dano e ouro
-- ============================================================

-- Registra o evento e aplica o dano (ou a cura, se negativo) no boss solo e no do clã.
-- p_id: id escolhido pelo cliente (hábito +/−), para o reenvio da fila offline não duplicar.
create function public._grant_event(
  p_user uuid, p_kind text, p_amount integer, p_quick boolean,
  p_task_id uuid, p_page_id uuid, p_completion_id uuid, p_cycle_key text,
  p_damage integer, p_crit boolean, p_gold integer, p_id uuid default null,
  out event_id uuid, out boss_defeated boolean
)
language plpgsql security definer set search_path = ''
as $$
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
$$;

drop function public._grant_xp(uuid, text, integer, boolean, uuid, uuid, uuid, text);

-- XP, dano e ouro de uma conclusão (chamado por complete_task e pelo lote)
create or replace function public._award_completion(
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

-- Sequência: um "+" num hábito bom também conta como dia ativo
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
  where e.user_id = p_user and not e.reverted and e.kind in ('task', 'too_fast', 'habit_plus') and e.day <= p_today;

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

-- Cache do perfil, agora com o ouro (profiles.coins)
create or replace function public._refresh_profile_stats(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_xp integer;
  v_streak record;
begin
  select coalesce(sum(amount), 0) into v_xp from public.xp_events where user_id = p_user and not reverted;
  select * into v_streak from public.streak_stats(p_user, public.user_today(p_user));
  update public.profiles
  set xp = v_xp,
      level = (public.level_for_xp(v_xp)).level,
      coins = public.gold_balance(p_user),
      streak = v_streak.current_streak,
      streak_best = v_streak.best_streak,
      last_active_date = (select max(day) from public.xp_events
                          where user_id = p_user and not reverted and kind in ('task', 'too_fast', 'habit_plus'))
  where id = p_user;
end;
$$;

-- ============================================================
-- Conquistas novas (D66)
-- ============================================================

insert into public.achievements (key, name, description, icon, position) values
  ('streak_3', 'Pegando ritmo', '3 dias seguidos concluindo tarefas', '🕯️', 11),
  ('tasks_10', 'Aquecendo', '10 tarefas concluídas', '🧹', 12),
  ('level_3', 'Aprendiz', 'Chegar ao nível 3', '🎒', 13),
  ('class_chosen', 'Escolha seu caminho', 'Escolher uma classe', '🧭', 14),
  ('first_skill', 'Poder especial', 'Usar a habilidade da sua classe', '💫', 15),
  ('first_crit', 'Golpe crítico', 'Acertar um crítico no boss', '💥', 16),
  ('big_hit', 'Golpe devastador', 'Causar 15 de dano ou mais num golpe só', '🌋', 17),
  ('attr_5', 'Treinado', 'Distribuir 5 pontos de atributo', '🏋️', 18),
  ('first_purchase', 'Primeira compra', 'Comprar um item na loja', '🛍️', 19),
  ('first_drop', 'Espólio', 'Ganhar um item de um boss', '🎁', 20),
  ('collector', 'Colecionador', 'Ter 10 itens', '🧳', 21),
  ('gold_500', 'Cofre cheio', 'Ganhar 500 de ouro no total', '💰', 22),
  ('counter_goal', 'Meta batida', 'Bater a meta de um hábito contador', '📈', 23),
  ('plus_50', 'Bons hábitos', 'Registrar 50 vezes um hábito bom', '🌿', 24),
  ('early_bird', 'Madrugador', 'Concluir uma tarefa antes das 7h', '🌅', 25),
  ('night_owl', 'Coruja', 'Concluir uma tarefa depois das 23h', '🦉', 26),
  ('clan_boss', 'Juntos somos mais', 'Derrotar um boss de clã', '🤝', 27),
  ('boss_5', 'Matador de chefes', 'Derrotar 5 bosses', '🗡️', 28),
  ('boss_level_5', 'Desafio à altura', 'Derrotar um boss de nível 5 ou mais', '🏔️', 29),
  ('level_20', 'Veterano', 'Chegar ao nível 20', '🎖️', 30),
  ('tasks_500', 'Quinhentas', '500 tarefas concluídas', '📜', 31),
  ('boss_25', 'Lenda viva', 'Derrotar 25 bosses', '🐲', 32),
  ('tasks_1000', 'Milhar', '1000 tarefas concluídas', '👑', 33);

create or replace function public._check_achievements(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
  select count(*) into v_bosses from public.xp_events
  where user_id = p_user and not reverted and kind = 'boss_reward';

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
$$;

-- Resumo para o app: além do XP, o golpe (dano, crítico), ouro e itens ganhos agora
create or replace function public._game_summary(p_user uuid, p_level_before integer, p_xp integer, p_boss_defeated boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
    -- now() é o início da transação: o que foi ganho nesta chamada
    'drops', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'name', i.name, 'icon', i.icon, 'rarity', i.rarity)), '[]')
              from public.user_items u join public.items i on i.key = u.item_key
              where u.user_id = p_user and u.source = 'drop' and u.acquired_at = now()));
end;
$$;

-- complete_task: o mesmo da Fase 3, devolvendo também dano, crítico e ouro
create or replace function public.complete_task(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page public.pages;
  v_tz text;
  v_kind text;
  v_key text;
  v_today date;
  v_completion uuid;
  v_level integer;
  v_award jsonb;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.status = 'done' then
    return jsonb_build_object('task', to_jsonb(v_task)) || public._game_summary(null, 0, 0, false);
  end if;
  select level into v_level from public.profiles where id = auth.uid();

  select * into v_page from public.pages where id = v_task.page_id;
  v_tz := public.folder_timezone(v_page.folder_id);
  v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence);
  v_today := (now() at time zone v_tz)::date;

  -- Recorrente comum: registra e avança a data; a tarefa continua aberta
  if v_kind = 'once' and v_task.parent_task_id is null
     and public.next_due_date(v_task.recurrence, v_task.due_date, v_today) is not null then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key, prev_due_date)
    values (v_task.id, v_task.folder_id, auth.uid(), 'r:' || gen_random_uuid(), v_task.due_date)
    returning id into v_completion;

    update public.tasks
    set due_date = public.next_due_date(v_task.recurrence, v_task.due_date, v_today)
    where id = p_task_id
    returning * into v_task;
    -- O golpe vê a data de antes (atrasada ou não)
    v_task.due_date := (select prev_due_date from public.task_completions where id = v_completion);
  else
    v_key := public.cycle_key_for(v_kind, v_tz, now(), v_page.manual_cycle);
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_task.id, v_task.folder_id, auth.uid(), v_key)
    on conflict (task_id, cycle_key) do update set completed_at = now(), user_id = excluded.user_id
    returning id into v_completion;

    update public.tasks
    set status = 'done', completed_by = auth.uid(), completed_at = now(), done_cycle_key = v_key
    where id = p_task_id
    returning * into v_task;
  end if;

  v_award := public._award_completion(v_task, v_page, v_completion, v_kind, false);
  select * into v_task from public.tasks where id = p_task_id;
  return jsonb_build_object('task', to_jsonb(v_task))
    || public._game_summary(auth.uid(), coalesce(v_level, 1), (v_award ->> 'xp')::integer,
                            (v_award ->> 'boss_defeated')::boolean)
    || jsonb_build_object('damage', (v_award ->> 'damage')::integer, 'crit', (v_award ->> 'crit')::boolean,
                          'gold', (v_award ->> 'gold')::integer);
end;
$$;

-- ============================================================
-- Hábitos: contador e bom/ruim (D63)
-- ============================================================

-- Chave do período em que as contagens do hábito valem (contador: ciclo do hábito; bom/ruim: o dia)
create function public.habit_count_key(p_task public.tasks, p_page public.pages)
returns text
language sql stable security definer set search_path = ''
as $$
  select public.cycle_key_for(
    case when p_task.habit_kind = 'plusminus' then 'daily'
         else public.task_cycle_kind(p_page.view_type, p_page.reset_cycle, p_task.recurrence) end,
    public.folder_timezone(p_page.folder_id), now(), p_page.manual_cycle);
$$;

-- Um toque no + ou no − de um hábito.
--   Contador: + soma 1 (ao bater a meta, conclui: XP e dano normais de hábito); − tira 1 (abaixo da meta, desfaz).
--   Bom/ruim: + é um hábito bom (XP, dano e ouro, até 10 por dia); − é um hábito ruim (cura o boss).
-- p_id: id do evento escolhido pelo cliente; reenviar o mesmo id não conta de novo.
create function public.habit_tick(p_task_id uuid, p_delta integer, p_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules();
  v_task public.tasks;
  v_page public.pages;
  v_key text;
  v_level integer;
  v_result jsonb := '{}';
  v_hit record;
  v_grant record;
  v_xp integer := 0;
  v_damage integer := 0;
  v_gold integer := 0;
  v_heal numeric;
  v_con integer;
  v_class text;
  v_capped boolean;
  v_crit boolean := false;
begin
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.habit_kind = 'check' then
    raise exception 'Este hábito é de marcar' using errcode = '22023';
  end if;
  if p_id is not null and exists (select 1 from public.xp_events where id = p_id) then
    -- Reenvio da fila offline
    return jsonb_build_object('task', to_jsonb(v_task), 'event_id', p_id);
  end if;
  select * into v_page from public.pages where id = v_task.page_id;
  select level, class into v_level, v_class from public.profiles where id = v_user;

  -- Período novo: zera as contagens
  v_key := public.habit_count_key(v_task, v_page);
  if v_task.count_key is distinct from v_key then
    update public.tasks set count_up = 0, count_down = 0, count_key = v_key where id = p_task_id returning * into v_task;
  end if;

  if v_task.habit_kind = 'counter' then
    if p_delta = 1 and v_task.count_up < coalesce(v_task.habit_target, 1) then
      update public.tasks set count_up = count_up + 1 where id = p_task_id returning * into v_task;
      if v_task.count_up >= coalesce(v_task.habit_target, 1) and v_task.status <> 'done' then
        v_result := public.complete_task(p_task_id);
      end if;
    elsif p_delta = -1 and v_task.count_up > 0 then
      update public.tasks set count_up = count_up - 1 where id = p_task_id returning * into v_task;
      if v_task.status = 'done' then
        v_result := public.uncomplete_task(p_task_id);
      end if;
    end if;
    select * into v_task from public.tasks where id = p_task_id;
    return v_result || jsonb_build_object('task', to_jsonb(v_task));
  end if;

  -- Bom/ruim
  if p_delta = 1 then
    update public.tasks set count_up = count_up + 1 where id = p_task_id returning * into v_task;
    v_capped := (select count(*) from public.xp_events where task_id = p_task_id and kind = 'habit_plus'
                 and not reverted and amount > 0 and day = public.user_today(v_user))
                >= (v_rules #>> '{antiFarm,habitPlusDailyCap}')::integer;
    if not v_capped then
      v_xp := (v_rules #>> '{xp,habitPlus}')::integer;
      select * into v_hit from public._attack(v_user, 'routine', (v_rules #>> '{damage,habitPlus}')::numeric, false);
      v_damage := v_hit.damage;
      v_crit := v_hit.crit;
      v_gold := public._gold_for(v_user, (v_rules #>> '{gold,habitPlus}')::integer);
    end if;
    select * into v_grant from public._grant_event(v_user, 'habit_plus', v_xp, false, p_task_id, v_page.id, null,
                                                   'p:' || coalesce(p_id, gen_random_uuid()), v_damage,
                                                   v_crit, v_gold, p_id);
  else
    update public.tasks set count_down = count_down + 1 where id = p_task_id returning * into v_task;
    -- Cura: menos com Constituição; metade para o paladino
    select con into v_con from public.character_attributes(v_user);
    v_heal := (v_rules #>> '{damage,habitMinusHeal}')::numeric
              * (1 - least((v_rules #>> '{attributes,healReduceMax}')::numeric,
                           (v_rules #>> '{attributes,healReducePerCon}')::numeric * v_con))
              * case when v_class = 'paladino' then 1 - (v_rules #>> '{skills,paladinHealReduce}')::numeric else 1 end;
    v_damage := -round(v_heal)::integer;
    select * into v_grant from public._grant_event(v_user, 'habit_minus', 0, false, p_task_id, v_page.id, null,
                                                   'm:' || coalesce(p_id, gen_random_uuid()), v_damage, false, 0, p_id);
  end if;

  return jsonb_build_object('task', to_jsonb(v_task), 'event_id', v_grant.event_id,
                            'damage', greatest(v_damage, 0), 'heal', greatest(-v_damage, 0),
                            'crit', v_crit and v_damage > 0, 'gold', v_gold)
    || public._game_summary(v_user, coalesce(v_level, 1), v_xp, coalesce(v_grant.boss_defeated, false));
end;
$$;

-- Desfaz um toque de hábito bom/ruim (o "Desfazer" do aviso)
create function public.undo_habit_tick(p_event_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.xp_events;
  v_task public.tasks;
  v_page public.pages;
  v_reverted integer;
begin
  select * into v_event from public.xp_events
  where id = p_event_id and user_id = auth.uid() and kind in ('habit_plus', 'habit_minus');
  if v_event.id is null then
    raise exception 'Registro não encontrado' using errcode = 'P0002';
  end if;
  select * into v_task from public.tasks where id = v_event.task_id for update;
  if v_event.reverted then
    return jsonb_build_object('task', to_jsonb(v_task));
  end if;
  v_reverted := public._revert_xp(array[p_event_id]);
  if v_task.id is not null then
    select * into v_page from public.pages where id = v_task.page_id;
    -- Só mexe na contagem se ainda for o mesmo período
    if v_task.count_key = public.habit_count_key(v_task, v_page) and v_event.day = public.user_today(auth.uid()) then
      update public.tasks
      set count_up = greatest(0, count_up - case when v_event.kind = 'habit_plus' then 1 else 0 end),
          count_down = greatest(0, count_down - case when v_event.kind = 'habit_minus' then 1 else 0 end)
      where id = v_task.id returning * into v_task;
    end if;
  end if;
  return jsonb_build_object('task', to_jsonb(v_task)) || public._game_summary(auth.uid(), 2147483647, -v_reverted, false);
end;
$$;

-- Ciclos: além de reabrir o que foi marcado num ciclo passado, zera as contagens dos hábitos
create or replace function public.refresh_cycles(p_page_id uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    select t.id
    from public.tasks t
    join public.pages p on p.id = t.page_id
    where t.status = 'done'
      and t.done_cycle_key is not null
      and t.done_cycle_key <> 'once'
      and (p_page_id is null or p.id = p_page_id)
      and (auth.uid() is null or public.is_folder_member(p.folder_id))
      and t.done_cycle_key <> public.cycle_key_for(
        public.task_cycle_kind(p.view_type, p.reset_cycle, t.recurrence),
        public.folder_timezone(p.folder_id), now(), p.manual_cycle
      )
  )
  update public.tasks t
  set status = 'todo', completed_by = null, completed_at = null, done_cycle_key = null
  from stale
  where t.id = stale.id;
  get diagnostics v_count = row_count;

  update public.tasks t
  set count_up = 0, count_down = 0, count_key = null
  from public.pages p
  where p.id = t.page_id and t.count_key is not null
    and (p_page_id is null or p.id = p_page_id)
    and (auth.uid() is null or public.is_folder_member(p.folder_id))
    and t.count_key <> public.habit_count_key(t, p);
  return v_count;
end;
$$;

-- ============================================================
-- Personagem: classe, atributos, habilidade (D60, D61)
-- ============================================================

create function public.set_class(p_class text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not (public.xp_rules() -> 'classes') ? p_class then
    raise exception 'Classe desconhecida' using errcode = '22023';
  end if;
  update public.profiles set class = p_class where id = auth.uid();
  return jsonb_build_object('achievements', public._check_achievements(auth.uid()));
end;
$$;

create function public.allocate_attribute(p_attr text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_attr not in ('str', 'agi', 'int', 'con') then
    raise exception 'Atributo desconhecido' using errcode = '22023';
  end if;
  if coalesce(public.attribute_points(auth.uid()), 0) < 1 then
    raise exception 'Sem pontos para distribuir' using errcode = '22023';
  end if;
  update public.profiles
  set attr_str = attr_str + case when p_attr = 'str' then 1 else 0 end,
      attr_agi = attr_agi + case when p_attr = 'agi' then 1 else 0 end,
      attr_int = attr_int + case when p_attr = 'int' then 1 else 0 end,
      attr_con = attr_con + case when p_attr = 'con' then 1 else 0 end
  where id = auth.uid();
  return jsonb_build_object('achievements', public._check_achievements(auth.uid()));
end;
$$;

-- Devolve todos os pontos (de graça: atributos são para experimentar)
create function public.reset_attributes()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set attr_str = 0, attr_agi = 0, attr_int = 0, attr_con = 0 where id = auth.uid();
$$;

-- Habilidade ativa da classe: uma vez por dia, vale até o fim do dia
create function public.use_skill()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles;
begin
  select * into v_p from public.profiles where id = auth.uid() for update;
  if v_p.id is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if v_p.class is null then
    raise exception 'Escolha uma classe primeiro' using errcode = '22023';
  end if;
  if v_p.skill_day = public.user_today(v_p.id) then
    raise exception 'A habilidade já foi usada hoje' using errcode = '22023';
  end if;
  update public.profiles set skill_day = public.user_today(v_p.id) where id = v_p.id;
  return jsonb_build_object('achievements', public._check_achievements(v_p.id));
end;
$$;

-- ============================================================
-- Loja e equipamento (D64)
-- ============================================================

create function public.buy_item(p_item text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  -- Uma compra por vez (o saldo é conferido com a linha do perfil travada)
  perform 1 from public.profiles where id = v_user for update;
  select * into v_item from public.items where key = p_item;
  if v_item.key is null or v_item.price is null then
    raise exception 'Item não está à venda' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_items where user_id = v_user and item_key = p_item) then
    raise exception 'Você já tem este item' using errcode = '22023';
  end if;
  if public.gold_balance(v_user) < v_item.price then
    raise exception 'Ouro insuficiente' using errcode = '22023';
  end if;
  insert into public.user_items (user_id, item_key, source, price) values (v_user, p_item, 'shop', v_item.price);
  perform public._refresh_profile_stats(v_user);
  return jsonb_build_object('gold', public.gold_balance(v_user),
                            'achievements', public._check_achievements(v_user));
end;
$$;

-- Equipa (ou tira, com p_item null) o item de um espaço
create function public.equip_item(p_slot text, p_item text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_slot not in ('head', 'hand', 'pet', 'aura', 'title') then
    raise exception 'Espaço desconhecido' using errcode = '22023';
  end if;
  if p_item is not null and not exists (
    select 1 from public.user_items u join public.items i on i.key = u.item_key
    where u.user_id = auth.uid() and u.item_key = p_item and i.slot = p_slot
  ) then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  update public.profiles
  set equipped = case when p_item is null then equipped - p_slot else equipped || jsonb_build_object(p_slot, p_item) end
  where id = auth.uid();
end;
$$;

-- ============================================================
-- Leitura
-- ============================================================

create or replace function public._boss_json(p_boss public.bosses)
returns jsonb
language sql stable set search_path = ''
as $$
  select case when p_boss.id is null then null else jsonb_build_object(
    'id', p_boss.id, 'name', p_boss.name, 'icon', p_boss.icon, 'max_hp', p_boss.max_hp, 'hp', p_boss.hp,
    'status', p_boss.status, 'ends_at', p_boss.ends_at, 'scope', p_boss.scope, 'level', p_boss.level) end;
$$;

-- Quadro de contribuição: só quem tem dano líquido positivo
create or replace function public.boss_board(p_boss_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
begin
  select * into v_boss from public.bosses where id = p_boss_id;
  if v_boss.id is null or not (
       (v_boss.scope = 'user' and v_boss.scope_id = auth.uid())
    or (v_boss.scope = 'folder' and public.is_folder_member(v_boss.scope_id))
    or (v_boss.scope = 'clan' and v_boss.scope_id = public.my_clan())) then
    raise exception 'Boss não encontrado' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', d.user_id, 'name', p.display_name, 'damage', d.damage)
                     order by d.damage desc, p.display_name)
    from (
      select user_id, sum(amount)::integer as damage from public.boss_damage
      where boss_id = p_boss_id and v_boss.scope <> 'folder' group by user_id having sum(amount) > 0
      union all
      select completed_by, count(*)::integer from public.tasks
      where v_boss.scope = 'folder' and public.folder_root(folder_id) = v_boss.scope_id and parent_task_id is null
        and status = 'done' and completed_by is not null and completed_at >= v_boss.starts_at
      group by completed_by
    ) d join public.profiles p on p.id = d.user_id
  ), '[]');
end;
$$;

create or replace function public.game_state()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_boss public.bosses;
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
    'bosses_defeated', (select count(*) from public.xp_events
                        where user_id = v_user and not reverted and kind = 'boss_reward'),
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
$$;

-- Exportação: inclui os itens
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]')
  );
end;
$$;

-- ============================================================
-- Permissões
-- ============================================================

revoke execute on function
  public.character_attributes(uuid), public.gold_balance(uuid), public.attribute_points(uuid),
  public._attack(uuid, text, numeric, boolean), public._gold_for(uuid, integer), public._cap_quick_damage(uuid, integer),
  public._roll_drop(uuid, integer), public.habit_count_key(public.tasks, public.pages),
  public._grant_event(uuid, text, integer, boolean, uuid, uuid, uuid, text, integer, boolean, integer, uuid)
  from public, anon, authenticated;

revoke execute on function
  public.habit_tick(uuid, integer, uuid), public.undo_habit_tick(uuid), public.set_class(text),
  public.allocate_attribute(text), public.reset_attributes(), public.use_skill(), public.buy_item(text),
  public.equip_item(text, text)
  from public, anon;
grant execute on function
  public.habit_tick(uuid, integer, uuid), public.undo_habit_tick(uuid), public.set_class(text),
  public.allocate_attribute(text), public.reset_attributes(), public.use_skill(), public.buy_item(text),
  public.equip_item(text, text)
  to authenticated;
