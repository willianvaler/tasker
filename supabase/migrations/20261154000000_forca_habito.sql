-- HB2 (ESCOPO_V8 §1, D194): força do hábito bom/ruim e hábito só bom ou só ruim.
-- Regra do Habitica (docs/HABITICA.md §1). Espelho em src/lib/habit-value.ts, com os mesmos casos.

alter table public.tasks
  add column habit_value numeric(8, 4) not null default 0,
  add column habit_value_day date,
  add column habit_sides text not null default 'both'
    constraint tasks_habit_sides check (habit_sides in ('both', 'up', 'down'));

-- O valor é do servidor; os lados, a pessoa escolhe
grant insert (habit_sides), update (habit_sides) on public.tasks to authenticated;

-- Um toque: + soma 0,9747^v; − acha w com w + 0,9747^w = v (Newton). Limites do Habitica.
create function public._habit_step(p_value numeric, p_delta integer)
returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  v double precision := least(21.27, greatest(-47.27, p_value::double precision));
  w double precision;
  f double precision;
begin
  if p_delta = 1 then
    return round(least(21.27, v + 0.9747 ^ v)::numeric, 4);
  end if;
  w := v - 0.9747 ^ v;
  for i in 1..20 loop
    f := w + 0.9747 ^ w - v;
    exit when abs(f) < 1e-9;
    w := w - f / (1 + 0.9747 ^ w * ln(0.9747));
  end loop;
  return round(greatest(-47.27, w)::numeric, 4);
end;
$$;

-- Valor de hoje: um lado só perde metade por dia sem uso (zera abaixo de 0,1); dois lados não decai
create function public.habit_value_now(p_value numeric, p_sides text, p_since date, p_today date)
returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when p_sides = 'both' or p_since is null or p_today <= p_since then p_value
    when abs(p_value / power(2::numeric, p_today - p_since)) < 0.1 then 0
    else round(p_value / power(2::numeric, p_today - p_since), 4)
  end;
$$;

CREATE OR REPLACE FUNCTION public.habit_tick(p_task_id uuid, p_delta integer, p_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_today date;
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

  -- Bom/ruim. Só bom ou só ruim: o outro botão não existe (HB2)
  if (p_delta = 1 and v_task.habit_sides = 'down') or (p_delta = -1 and v_task.habit_sides = 'up') then
    raise exception 'Este hábito não tem esse lado' using errcode = '22023';
  end if;
  -- Força (D194): o + soma 0,9747^v, o − é o inverso exato; um lado só decai pela metade por dia
  v_today := public.user_today(v_user);
  update public.tasks
  set habit_value = public._habit_step(
        public.habit_value_now(habit_value, habit_sides, habit_value_day, v_today), p_delta),
      habit_value_day = v_today
  where id = p_task_id returning * into v_task;

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
                            'crit', v_crit and v_damage > 0, 'gold', v_gold,
                            -- O3: o "+" passou do teto do dia (vale, mas sem XP, dano e ouro)
                            'limit', case when v_capped then 'habit' end)
    || public._game_summary(v_user, coalesce(v_level, 1), v_xp, coalesce(v_grant.boss_defeated, false));
end;
$function$;

create or replace function public.undo_habit_tick(p_event_id uuid)
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
    -- Força: o toque contrário desfaz exatamente (D194)
    update public.tasks
    set habit_value = public._habit_step(
          public.habit_value_now(habit_value, habit_sides, habit_value_day, public.user_today(auth.uid())),
          case when v_event.kind = 'habit_plus' then -1 else 1 end),
        habit_value_day = public.user_today(auth.uid())
    where id = v_task.id returning * into v_task;
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
