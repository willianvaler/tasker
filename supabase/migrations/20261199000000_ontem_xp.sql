-- "Fiz ontem" (CD39) também dá XP, ouro e golpe: a pessoa fez, só esqueceu de marcar.
-- A chave do XP da recorrente comum e do ciclo manual passa a vir do dia da conclusão (não de
-- hoje): nas conclusões normais é o mesmo dia; na de ontem, não colide com a de hoje.
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
  v_done_day date;
begin
  if v_user is null then
    return jsonb_build_object('xp', 0, 'damage', 0, 'crit', false, 'gold', 0, 'boss_defeated', false);
  end if;
  v_today := public.user_today(v_user);
  -- No fuso de quem concluiu, como o user_today
  select c.cycle_key, (c.completed_at at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = v_user), 'America/Sao_Paulo'))::date
  into v_cycle, v_done_day from public.task_completions c where c.id = p_completion_id;
  v_key := case
    when p_cycle_kind = 'manual' then 'd:' || coalesce(v_done_day, v_today)
    when v_cycle like 'r:%' then 'r:' || coalesce(v_done_day, v_today)
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

create or replace function public.day_start(p_did uuid[] default '{}')
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
  v_did record;
  v_at timestamptz;
  v_kind text;
  v_task public.tasks;
  v_page public.pages;
  v_completion uuid;
  v_award jsonb;
  v_xp integer := 0;
  v_gold integer := 0;
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

  -- O que a pessoa marcou como feito ontem vira conclusão de ontem (meio-dia no fuso da pasta),
  -- com XP, ouro e golpe como se tivesse marcado na hora (a chave do XP é a do dia da conclusão)
  for v_did in
    select m.task_id, public.folder_timezone(t.folder_id) as tz
    from public._missed_dailies(v_user, v_today - 1) m
    join public.tasks t on t.id = m.task_id
    where m.task_id = any (coalesce(p_did, '{}'))
  loop
    select * into v_task from public.tasks where id = v_did.task_id for update;
    select * into v_page from public.pages where id = v_task.page_id;
    v_at := ((v_today - 1)::timestamp + interval '12 hours') at time zone v_did.tz;
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence);
    v_completion := null;
    if v_kind = 'once' and public.next_due_date(v_task.recurrence, v_task.due_date, v_today - 1) is not null then
      insert into public.task_completions (task_id, folder_id, user_id, completed_at, cycle_key, prev_due_date)
      values (v_task.id, v_task.folder_id, v_user, v_at, 'r:' || gen_random_uuid(), v_task.due_date)
      returning id into v_completion;
      update public.tasks set due_date = public.next_due_date(v_task.recurrence, v_task.due_date, v_today - 1)
      where id = v_task.id;
    else
      insert into public.task_completions (task_id, folder_id, user_id, completed_at, cycle_key)
      values (v_task.id, v_task.folder_id, v_user, v_at,
              public.cycle_key_for(v_kind, v_did.tz, v_at, v_page.manual_cycle))
      on conflict (task_id, cycle_key) do nothing
      returning id into v_completion;
    end if;
    if v_completion is not null then
      v_award := public._award_completion(v_task, v_page, v_completion, v_kind, false);
      v_xp := v_xp + coalesce((v_award ->> 'xp')::integer, 0);
      v_gold := v_gold + coalesce((v_award ->> 'gold')::integer, 0);
    end if;
  end loop;

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
                            'buff', case when v_perfect then v_p.buff_amount else 0 end,
                            'xp', v_xp, 'gold', v_gold);
end;
$$;
