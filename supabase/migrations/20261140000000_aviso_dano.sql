-- V4 §1.2/1.3 (O3): o aviso de conclusão mostra o dano no diário e no semanal e diz quando um
-- limite do dia foi atingido. O resumo ganha `bosses` (diário e semanal depois do golpe),
-- `defeated_now` (quem caiu nesta ação: daily, user, clan) e `limit` ('quick' = teto diário das
-- tarefas rápidas; 'habit' = os 10 "+" do dia deste hábito).

CREATE OR REPLACE FUNCTION public._award_leaf_completion(p_task tasks, p_page pages, p_completion_id uuid, p_cycle_kind text, p_created_done boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_limit text;
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
      if v_damage < v_hit.damage then
        v_limit := 'quick';
      end if;
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
        if v_amount < v_base then
          v_limit := 'quick';
        end if;
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
                            'boss_defeated', v_defeated, 'limit', v_limit);
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_task(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
                          'gold', (v_award ->> 'gold')::integer, 'limit', v_award ->> 'limit');
end;
$function$;

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
                            'crit', v_crit and v_damage > 0, 'gold', v_gold,
                            -- O3: o "+" passou do teto do dia (vale, mas sem XP, dano e ouro)
                            'limit', case when v_capped then 'habit' end)
    || public._game_summary(v_user, coalesce(v_level, 1), v_xp, coalesce(v_grant.boss_defeated, false));
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
                            or (b.scope = 'clan' and b.scope_id = (select clan_id from public.clan_members where user_id = p_user)))),
    -- now() é o início da transação: o que foi ganho nesta chamada
    'drops', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'name', i.name, 'icon', i.icon, 'rarity', i.rarity)), '[]')
              from public.user_items u join public.items i on i.key = u.item_key
              where u.user_id = p_user and u.source = 'drop' and u.acquired_at = now()));
end;
$function$;
