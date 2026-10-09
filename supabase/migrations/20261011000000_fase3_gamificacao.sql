-- Fase 3: gamificação solo (ESCOPO 4.6). Ledger de XP com anti-farm, níveis, sequência global com
-- congelamento, conquistas e boss semanal. Tudo é calculado aqui; o app só lê (game_state).
--
-- Ledger (xp_events): toda concessão é uma linha; desmarcar marca a linha como revertida. O XP e a
-- sequência do perfil são cache da soma do ledger, recalculados na mesma transação.
--
-- Chave de XP por tarefa (no máximo 1 evento não revertido por tarefa e chave, D34):
--   ciclos diário/semanal/mensal e 'once' → a chave do ciclo da conclusão
--   reset manual                           → 'd:' || dia  (reiniciar na mão não gera XP de novo no mesmo dia)
--   recorrente comum                       → 'r:' || dia  (avançar a data várias vezes no dia não gera XP)
--
-- Boss solo: dano = XP ganho (D33). Damage de eventos revertidos sai junto; o boss pode voltar à vida
-- se ainda for a semana dele.

-- ============================================================
-- Regras (espelho de src/lib/gamification.config.ts; o teste gamification.test.ts compara os dois)
-- ============================================================

create function public.xp_rules()
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
      "pageBonusMinItems": 3
    },
    "antiFarm": { "tooFastSeconds": 30, "quickSeconds": 300, "dailyQuickCap": 50 },
    "level": { "base": 100, "exponent": 1.4 },
    "boss": { "minHp": 100, "hpPerLevel": 15, "recentWeeks": 4, "recentFactor": 0.8, "rewardXp": 50 }
  }
  $json$::jsonb;
$$;

-- XP para passar do nível p_level ao seguinte: round(100 * nível ^ 1.4). Espelho: xpToNext (src/lib/gamification.ts)
create function public.xp_to_next(p_level integer)
returns integer
language sql immutable set search_path = ''
as $$
  select round(
    (public.xp_rules() #>> '{level,base}')::numeric
    * power(p_level::numeric, (public.xp_rules() #>> '{level,exponent}')::numeric)
  )::integer;
$$;

-- Nível a partir do XP total. Espelho: levelFromXp (src/lib/gamification.ts)
create function public.level_for_xp(p_xp integer, out level integer, out into_level integer, out for_next integer)
language plpgsql immutable set search_path = ''
as $$
begin
  level := 1;
  into_level := greatest(p_xp, 0);
  while into_level >= public.xp_to_next(level) loop
    into_level := into_level - public.xp_to_next(level);
    level := level + 1;
  end loop;
  for_next := public.xp_to_next(level);
end;
$$;

-- ============================================================
-- Tabelas
-- ============================================================

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Apagar a tarefa ou a página não tira o XP já ganho
  task_id uuid references public.tasks (id) on delete set null,
  page_id uuid references public.pages (id) on delete set null,
  completion_id uuid references public.task_completions (id) on delete set null,
  boss_id uuid,
  cycle_key text,
  -- task: conclusão · too_fast: relâmpago, 0 XP · page_bonus: página de cards inteira · boss_reward: boss derrotado
  kind text not null check (kind in ('task', 'too_fast', 'page_bonus', 'boss_reward')),
  amount integer not null check (amount >= 0),
  -- Concluída logo depois de criada: entra no teto diário
  quick boolean not null default false,
  -- Dia no fuso do usuário (teto diário e sequência)
  day date not null,
  reverted boolean not null default false,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);
-- Anti-farm, regra 1: uma concessão por tarefa e ciclo
create unique index xp_events_one_per_cycle on public.xp_events (task_id, cycle_key)
  where not reverted and task_id is not null;
create unique index xp_events_one_page_bonus on public.xp_events (page_id, cycle_key)
  where not reverted and kind = 'page_bonus';
create unique index xp_events_one_boss_reward on public.xp_events (boss_id)
  where not reverted and kind = 'boss_reward';
create index xp_events_user_day_idx on public.xp_events (user_id, day) where not reverted;
create index xp_events_completion_id_idx on public.xp_events (completion_id);

create table public.bosses (
  id uuid primary key default gen_random_uuid(),
  -- 'folder' e 'clan' chegam na Fase 5
  scope text not null default 'user' check (scope in ('user', 'folder', 'clan')),
  scope_id uuid not null,
  name text not null,
  icon text not null,
  -- Semana ISO no fuso do dono ('2026-W41')
  period_key text not null,
  max_hp integer not null check (max_hp > 0),
  hp integer not null check (hp >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'defeated', 'escaped')),
  defeated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (scope, scope_id, period_key)
);
create index bosses_scope_status_idx on public.bosses (scope, scope_id, status);

alter table public.xp_events
  add constraint xp_events_boss_id_fkey foreign key (boss_id) references public.bosses (id) on delete set null;

create table public.boss_damage (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references public.bosses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  xp_event_id uuid not null unique references public.xp_events (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index boss_damage_boss_id_idx on public.boss_damage (boss_id);

create table public.achievements (
  key text primary key,
  name text not null,
  description text not null,
  icon text not null,
  position integer not null
);

insert into public.achievements (key, name, description, icon, position) values
  ('first_task', 'Primeiro passo', 'Concluir a primeira tarefa', '🌱', 1),
  ('page_complete', 'Checklist fechado', 'Marcar uma página de cards inteira', '✅', 2),
  ('streak_7', 'Uma semana', '7 dias seguidos concluindo tarefas', '🔥', 3),
  ('tasks_100', 'Centena', '100 tarefas concluídas', '💯', 4),
  ('first_boss', 'Caçador de chefes', 'Derrotar o primeiro boss', '⚔️', 5),
  ('level_5', 'Nível 5', 'Chegar ao nível 5', '⭐', 6),
  ('streak_30', 'Um mês', '30 dias seguidos concluindo tarefas', '🌟', 7),
  ('level_10', 'Nível 10', 'Chegar ao nível 10', '🏅', 8),
  ('streak_100', 'Imparável', '100 dias seguidos concluindo tarefas', '🏆', 9);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_key text not null references public.achievements (key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

-- ============================================================
-- RLS: cada um vê só o seu; escrita só pelas funções do servidor
-- ============================================================

alter table public.xp_events enable row level security;
alter table public.bosses enable row level security;
alter table public.boss_damage enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

revoke all on public.xp_events, public.bosses, public.boss_damage, public.achievements, public.user_achievements
  from anon, authenticated;
grant select on public.xp_events, public.bosses, public.boss_damage, public.achievements, public.user_achievements
  to authenticated;

create policy "xp_events_select" on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "bosses_select" on public.bosses for select to authenticated
  using (scope = 'user' and scope_id = (select auth.uid()));
create policy "boss_damage_select" on public.boss_damage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "achievements_select" on public.achievements for select to authenticated
  using (true);
create policy "user_achievements_select" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================
-- Sequência, boss, estatísticas
-- ============================================================

create function public.user_today(p_user uuid)
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.profiles where id = p_user), 'America/Sao_Paulo'))::date;
$$;

-- Sequência global: dias com ao menos uma conclusão. Um dia sem nada é coberto pelo congelamento
-- da semana dele (1 por semana ISO, automático) se o dia seguinte tiver atividade (ou for hoje).
-- Hoje sem atividade ainda não quebra: o dia não acabou.
create function public.streak_stats(
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
  where e.user_id = p_user and not e.reverted and e.kind in ('task', 'too_fast') and e.day <= p_today;

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

-- Recalcula o cache do perfil (XP, nível, sequência) a partir do ledger (ESCOPO 4.6, regra 6)
create function public._refresh_profile_stats(p_user uuid)
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
      streak = v_streak.current_streak,
      streak_best = v_streak.best_streak,
      last_active_date = (select max(day) from public.xp_events
                          where user_id = p_user and not reverted and kind in ('task', 'too_fast'))
  where id = p_user;
end;
$$;

-- Boss da semana do usuário: cria se não existir (e o da semana passada foge, sem punição)
create function public.ensure_weekly_boss(p_user uuid)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_level integer;
  v_key text;
  v_week_start date;
  v_boss public.bosses;
  v_rules jsonb := public.xp_rules() -> 'boss';
  v_recent numeric;
  v_hp integer;
  v_names text[] := array['Procrastinossauro', 'Hidra das Pendências', 'Golem da Bagunça',
                          'Dragão do Adiamento', 'Kraken das Notificações', 'Lich do Sofá', 'Quimera do Depois'];
  v_icons text[] := array['🦖', '🐍', '🗿', '🐉', '🐙', '💀', '🦁'];
  v_pick integer;
begin
  select timezone, level into v_tz, v_level from public.profiles where id = p_user;
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

  v_week_start := date_trunc('week', now() at time zone v_tz)::date;
  select coalesce(sum(amount), 0)::numeric / (v_rules ->> 'recentWeeks')::integer into v_recent
  from public.xp_events
  where user_id = p_user and not reverted and kind <> 'boss_reward'
    and day >= v_week_start - 7 * (v_rules ->> 'recentWeeks')::integer and day < v_week_start;
  v_hp := greatest(
    (v_rules ->> 'minHp')::integer + (v_rules ->> 'hpPerLevel')::integer * v_level,
    round(v_recent * (v_rules ->> 'recentFactor')::numeric)::integer
  );
  v_pick := (extract(week from v_week_start)::integer % cardinality(v_names)) + 1;

  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, starts_at, ends_at)
  values ('user', p_user, v_names[v_pick], v_icons[v_pick], v_key, v_hp, v_hp,
          v_week_start::timestamp at time zone v_tz, (v_week_start + 7)::timestamp at time zone v_tz)
  on conflict (scope, scope_id, period_key) do nothing
  returning * into v_boss;
  if v_boss.id is null then
    select * into v_boss from public.bosses where scope = 'user' and scope_id = p_user and period_key = v_key;
  end if;
  return v_boss;
end;
$$;

-- Recalcula o HP do boss pelo dano registrado; derrota (com recompensa) ou volta à vida
create function public._settle_boss(p_boss_id uuid)
returns boolean -- true = derrotado agora
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
  v_damage integer;
  v_hp integer;
begin
  select * into v_boss from public.bosses where id = p_boss_id for update;
  if v_boss.id is null or v_boss.status = 'escaped' then
    return false;
  end if;
  select coalesce(sum(amount), 0) into v_damage from public.boss_damage where boss_id = p_boss_id;
  v_hp := greatest(0, v_boss.max_hp - v_damage);
  update public.bosses set hp = v_hp where id = p_boss_id;

  if v_hp = 0 and v_boss.status = 'active' then
    update public.bosses set status = 'defeated', defeated_at = now() where id = p_boss_id;
    insert into public.xp_events (user_id, boss_id, kind, amount, day)
    values (v_boss.scope_id, p_boss_id, 'boss_reward', (public.xp_rules() #>> '{boss,rewardXp}')::integer,
            public.user_today(v_boss.scope_id))
    on conflict do nothing;
    return true;
  elsif v_hp > 0 and v_boss.status = 'defeated' then
    -- Desmarcar tirou o golpe final: o boss volta e a recompensa sai
    update public.bosses set status = 'active', defeated_at = null where id = p_boss_id;
    update public.xp_events set reverted = true, reverted_at = now()
    where boss_id = p_boss_id and kind = 'boss_reward' and not reverted;
  end if;
  return false;
end;
$$;

-- Registra um evento de XP e aplica o dano no boss da semana. Devolve o evento (null se a regra 1
-- barrou: já existe concessão para essa tarefa nesse ciclo).
create function public._grant_xp(
  p_user uuid, p_kind text, p_amount integer, p_quick boolean,
  p_task_id uuid, p_page_id uuid, p_completion_id uuid, p_cycle_key text,
  out event_id uuid, out boss_defeated boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
begin
  boss_defeated := false;
  insert into public.xp_events (user_id, task_id, page_id, completion_id, cycle_key, kind, amount, quick, day)
  values (p_user, p_task_id, p_page_id, p_completion_id, p_cycle_key, p_kind, p_amount, p_quick,
          public.user_today(p_user))
  on conflict do nothing
  returning id into event_id;

  if event_id is not null and p_amount > 0 then
    v_boss := public.ensure_weekly_boss(p_user);
    -- Dano conta mesmo com o boss já derrotado: assim desmarcar uma tarefa antiga não o ressuscita
    -- se as conclusões seguintes cobrem o HP
    if v_boss.id is not null and v_boss.status <> 'escaped' then
      insert into public.boss_damage (boss_id, user_id, xp_event_id, amount)
      values (v_boss.id, p_user, event_id, p_amount);
      boss_defeated := public._settle_boss(v_boss.id);
    end if;
  end if;
end;
$$;

-- Reverte eventos (regra 2): marca como revertidos, tira o dano do boss e recalcula
create function public._revert_xp(p_event_ids uuid[])
returns integer -- XP revertido
language plpgsql security definer set search_path = ''
as $$
declare
  v_total integer;
  v_boss_ids uuid[];
  v_boss_id uuid;
begin
  if p_event_ids is null or cardinality(p_event_ids) = 0 then
    return 0;
  end if;
  with reverted as (
    update public.xp_events set reverted = true, reverted_at = now()
    where id = any (p_event_ids) and not reverted
    returning amount
  )
  select coalesce(sum(amount), 0) into v_total from reverted;

  with removed as (
    delete from public.boss_damage where xp_event_id = any (p_event_ids) returning boss_id
  )
  select array_agg(distinct boss_id) into v_boss_ids from removed;
  foreach v_boss_id in array coalesce(v_boss_ids, '{}') loop
    perform public._settle_boss(v_boss_id);
  end loop;
  return v_total;
end;
$$;

-- Desbloqueia as conquistas alcançadas; devolve as novas
create function public._check_achievements(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_done integer;
  v_keys text[] := '{}';
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  select count(*) into v_done from public.xp_events
  where user_id = p_user and not reverted and kind in ('task', 'too_fast');

  if v_done >= 1 then v_keys := array_append(v_keys, 'first_task'); end if;
  if v_done >= 100 then v_keys := array_append(v_keys, 'tasks_100'); end if;
  if v_profile.streak_best >= 7 then v_keys := array_append(v_keys, 'streak_7'); end if;
  if v_profile.streak_best >= 30 then v_keys := array_append(v_keys, 'streak_30'); end if;
  if v_profile.streak_best >= 100 then v_keys := array_append(v_keys, 'streak_100'); end if;
  if v_profile.level >= 5 then v_keys := array_append(v_keys, 'level_5'); end if;
  if v_profile.level >= 10 then v_keys := array_append(v_keys, 'level_10'); end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'page_bonus') then
    v_keys := array_append(v_keys, 'page_complete');
  end if;
  if exists (select 1 from public.bosses where scope = 'user' and scope_id = p_user and status = 'defeated') then
    v_keys := array_append(v_keys, 'first_boss');
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

-- ============================================================
-- XP de uma conclusão (chamado por complete_task e pelo lote)
-- ============================================================

create function public._award_completion(
  p_task public.tasks, p_page public.pages, p_completion_id uuid, p_cycle_kind text, p_created_done boolean
)
returns jsonb -- {xp, boss_defeated}
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := public.xp_rules();
  v_today date;
  v_key text;
  v_base integer;
  v_amount integer;
  v_kind text := 'task';
  v_quick boolean;
  v_routine boolean := p_page.view_type in ('cards', 'habits');
  v_age interval := now() - p_task.created_at;
  v_used integer;
  v_grant record;
  v_xp integer := 0;
  v_defeated boolean := false;
  v_items integer;
  v_open integer;
  v_cycle text;
begin
  if v_user is null then
    return jsonb_build_object('xp', 0, 'boss_defeated', false);
  end if;
  v_today := public.user_today(v_user);
  select cycle_key into v_cycle from public.task_completions where id = p_completion_id;
  v_key := case
    when p_cycle_kind = 'manual' then 'd:' || v_today
    when v_cycle like 'r:%' then 'r:' || v_today
    else v_cycle
  end;

  -- Valor base pelo tipo de item
  if p_page.view_type = 'habits' then
    v_base := (v_rules #>> '{xp,habit}')::integer + least(
      (public.streak_stats(v_user, v_today)).current_streak * (v_rules #>> '{xp,streakBonusPerDay}')::integer,
      (v_rules #>> '{xp,streakBonusMax}')::integer);
  elsif p_page.view_type = 'cards' or p_task.parent_task_id is not null then
    v_base := (v_rules #>> '{xp,checklistItem}')::integer;
  elsif p_task.recurrence is not null then
    v_base := (v_rules #>> '{xp,habit}')::integer + least(
      (public.streak_stats(v_user, v_today)).current_streak * (v_rules #>> '{xp,streakBonusPerDay}')::integer,
      (v_rules #>> '{xp,streakBonusMax}')::integer);
  else
    v_base := round((v_rules #>> '{xp,task}')::integer
                    * (v_rules -> 'xp' -> 'priorityMultiplier' ->> least(greatest(p_task.priority, 0), 3))::numeric);
  end if;

  -- Regra 3: relâmpago (inclui o [x] do lote, em qualquer tipo de página, D35)
  if p_created_done or (not v_routine and v_age < make_interval(secs => (v_rules #>> '{antiFarm,tooFastSeconds}')::integer)) then
    v_kind := 'too_fast';
    v_amount := 0;
    v_quick := false;
  else
    -- Regra 4: teto diário para o que foi concluído logo depois de criado (vale para todo tipo, D35)
    v_quick := v_age < make_interval(secs => (v_rules #>> '{antiFarm,quickSeconds}')::integer);
    v_amount := v_base;
    if v_quick then
      select coalesce(sum(amount), 0) into v_used from public.xp_events
      where user_id = v_user and day = v_today and quick and not reverted;
      v_amount := least(v_amount, greatest(0, (v_rules #>> '{antiFarm,dailyQuickCap}')::integer - v_used));
    end if;
  end if;

  select * into v_grant from public._grant_xp(v_user, v_kind, v_amount, v_quick, p_task.id, p_page.id,
                                              p_completion_id, v_key);
  if v_grant.event_id is not null then
    v_xp := v_amount;
    v_defeated := v_grant.boss_defeated;
  end if;

  -- Bônus da página de cards inteira no ciclo
  if p_page.view_type = 'cards' and p_task.parent_task_id is null and v_kind = 'task' then
    select count(*), count(*) filter (where status <> 'done') into v_items, v_open
    from public.tasks where page_id = p_page.id and parent_task_id is null;
    if v_open = 0 and v_items >= (v_rules #>> '{xp,pageBonusMinItems}')::integer then
      v_quick := now() - p_page.created_at < make_interval(secs => (v_rules #>> '{antiFarm,quickSeconds}')::integer);
      v_amount := (v_rules #>> '{xp,pageBonus}')::integer;
      if v_quick then
        select coalesce(sum(amount), 0) into v_used from public.xp_events
        where user_id = v_user and day = v_today and quick and not reverted;
        v_amount := least(v_amount, greatest(0, (v_rules #>> '{antiFarm,dailyQuickCap}')::integer - v_used));
      end if;
      select * into v_grant from public._grant_xp(v_user, 'page_bonus', v_amount, v_quick, null, p_page.id,
                                                  null, v_key);
      if v_grant.event_id is not null then
        v_xp := v_xp + v_amount;
        v_defeated := v_defeated or v_grant.boss_defeated;
      end if;
    end if;
  end if;

  return jsonb_build_object('xp', v_xp, 'boss_defeated', v_defeated);
end;
$$;

-- Reverte o XP de uma conclusão (e o bônus de página do mesmo ciclo, que deixou de valer)
create function public._revert_completion(p_completion_id uuid, p_page_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[];
  v_keys text[];
begin
  select array_agg(id), array_agg(cycle_key) into v_ids, v_keys
  from public.xp_events where completion_id = p_completion_id and not reverted;
  if v_ids is null then
    return 0;
  end if;
  v_ids := v_ids || coalesce((
    select array_agg(id) from public.xp_events
    where page_id = p_page_id and kind = 'page_bonus' and not reverted and cycle_key = any (v_keys)
  ), '{}');
  return public._revert_xp(v_ids);
end;
$$;

-- Resumo para o app: XP ganho, subiu de nível, boss, conquistas novas
create function public._game_summary(p_user uuid, p_level_before integer, p_xp integer, p_boss_defeated boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_level integer;
  v_new jsonb := '[]';
begin
  if p_user is null then
    return jsonb_build_object('xp', 0, 'level', null, 'level_up', false, 'boss_defeated', false, 'achievements', '[]'::jsonb);
  end if;
  perform public._refresh_profile_stats(p_user);
  select level into v_level from public.profiles where id = p_user;
  if p_xp > 0 then
    v_new := public._check_achievements(p_user);
  end if;
  return jsonb_build_object('xp', p_xp, 'level', v_level, 'level_up', v_level > p_level_before,
                            'boss_defeated', p_boss_defeated, 'achievements', v_new);
end;
$$;

-- ============================================================
-- Concluir / desfazer: agora devolvem {task, xp, level, level_up, boss_defeated, achievements}
-- ============================================================

drop function public.complete_task(uuid);
drop function public.uncomplete_task(uuid);

create function public.complete_task(p_task_id uuid)
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
  return jsonb_build_object('task', to_jsonb(v_task))
    || public._game_summary(auth.uid(), coalesce(v_level, 1), (v_award ->> 'xp')::integer,
                            (v_award ->> 'boss_defeated')::boolean);
end;
$$;

create function public.uncomplete_task(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_last public.task_completions;
  v_reverted integer := 0;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;

  if v_task.status = 'done' then
    select * into v_last from public.task_completions
    where task_id = p_task_id and cycle_key = v_task.done_cycle_key;
    v_reverted := public._revert_completion(v_last.id, v_task.page_id);
    delete from public.task_completions where id = v_last.id;
    update public.tasks
    set status = 'todo', completed_by = null, completed_at = null, done_cycle_key = null
    where id = p_task_id
    returning * into v_task;
  else
    -- Aberta e recorrente: desfaz a última conclusão (volta a data de antes)
    select * into v_last from public.task_completions
    where task_id = p_task_id and cycle_key like 'r:%'
    -- Desempate pela data da ocorrência: duas conclusões no mesmo instante desfazem a mais nova
    order by completed_at desc, prev_due_date desc nulls last limit 1;
    if v_last.id is not null then
      v_reverted := public._revert_completion(v_last.id, v_task.page_id);
      delete from public.task_completions where id = v_last.id;
      update public.tasks set due_date = v_last.prev_due_date where id = p_task_id returning * into v_task;
    end if;
  end if;

  -- Nível "antes" no máximo: desfazer nunca anuncia subida de nível
  return jsonb_build_object('task', to_jsonb(v_task))
    || public._game_summary(auth.uid(), 2147483647, -v_reverted, false);
end;
$$;

-- ============================================================
-- Lote: [x] gera evento relâmpago (0 XP), para o histórico e a sequência ficarem consistentes
-- ============================================================

create or replace function public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_kind text;
  v_key text;
  v_completion uuid;
  v_page public.pages;
  v_task public.tasks;
  v_recurrence jsonb := case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end;
begin
  if p_parent_id is not null and p_item ? 'children' and jsonb_array_length(p_item -> 'children') > 0 then
    raise exception 'Subtarefa não pode ter subtarefas' using errcode = '22023';
  end if;

  select * into v_page from public.pages where id = p_page_id;
  if v_done then
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_recurrence);
    v_key := public.cycle_key_for(v_kind, public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, labels, recurrence, meta, position,
    created_by, status, completed_by, completed_at, done_cycle_key
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    v_recurrence,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key
  )
  returning * into v_task;
  v_id := v_task.id;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_id, v_task.folder_id, auth.uid(), v_key)
    returning id into v_completion;
    perform public._award_completion(v_task, v_page, v_completion, v_kind, true);
    perform public._refresh_profile_stats(auth.uid());
  end if;
  return v_id;
end;
$$;

-- ============================================================
-- Estado do jogo para o app
-- ============================================================

create function public.game_state()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_boss public.bosses;
  v_level record;
  v_streak record;
  v_today date;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  v_boss := public.ensure_weekly_boss(v_user);
  -- A sequência muda com o tempo (o dia virou sem atividade), então o cache é refeito na leitura
  perform public._refresh_profile_stats(v_user);
  select * into v_profile from public.profiles where id = v_user;
  v_today := public.user_today(v_user);
  select * into v_level from public.level_for_xp(v_profile.xp);
  select * into v_streak from public.streak_stats(v_user, v_today);

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
                            and not reverted and kind in ('task', 'too_fast')),
    'xp_today', (select coalesce(sum(amount), 0) from public.xp_events
                 where user_id = v_user and day = v_today and not reverted),
    'tasks_done', (select count(*) from public.xp_events
                   where user_id = v_user and not reverted and kind in ('task', 'too_fast')),
    'boss', case when v_boss.id is null then null else jsonb_build_object(
      'id', v_boss.id, 'name', v_boss.name, 'icon', v_boss.icon, 'max_hp', v_boss.max_hp, 'hp', v_boss.hp,
      'status', v_boss.status, 'ends_at', v_boss.ends_at
    ) end,
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

-- ============================================================
-- Permissões e cron
-- ============================================================

revoke execute on function
  public.user_today(uuid), public.streak_stats(uuid, date), public._refresh_profile_stats(uuid),
  public.ensure_weekly_boss(uuid), public._settle_boss(uuid),
  public._grant_xp(uuid, text, integer, boolean, uuid, uuid, uuid, text), public._revert_xp(uuid[]),
  public._check_achievements(uuid), public._award_completion(public.tasks, public.pages, uuid, text, boolean),
  public._revert_completion(uuid, uuid), public._game_summary(uuid, integer, integer, boolean)
  from public, anon, authenticated;

revoke execute on function public.complete_task(uuid), public.uncomplete_task(uuid), public.game_state()
  from public, anon;
grant execute on function public.complete_task(uuid), public.uncomplete_task(uuid), public.game_state()
  to authenticated;

-- Bosses de semanas passadas fogem (sem punição). O da semana nova nasce quando o app abre.
select cron.schedule('questlist-escape-bosses', '5 * * * *',
  $$update public.bosses set status = 'escaped' where status = 'active' and ends_at < now()$$);
