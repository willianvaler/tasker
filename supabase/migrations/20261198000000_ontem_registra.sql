-- "O que você fez ontem?" (HB5): a diária marcada como feita deixa de só poupar a vida e passa a
-- registrar a conclusão de ontem, para a sequência do hábito e o histórico contarem o dia. Sem XP
-- (é o registro do que a pessoa esqueceu de marcar). Na recorrente comum, a data avança como se
-- tivesse sido concluída ontem (a de hoje continua valendo).
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

  -- O que a pessoa marcou como feito ontem vira conclusão de ontem (meio-dia no fuso da pasta)
  for v_did in
    select t.*, pg.view_type, pg.reset_cycle, pg.manual_cycle, public.folder_timezone(t.folder_id) as tz
    from public._missed_dailies(v_user, v_today - 1) m
    join public.tasks t on t.id = m.task_id
    join public.pages pg on pg.id = t.page_id
    where m.task_id = any (coalesce(p_did, '{}'))
  loop
    v_at := ((v_today - 1)::timestamp + interval '12 hours') at time zone v_did.tz;
    v_kind := public.task_cycle_kind(v_did.view_type, v_did.reset_cycle, v_did.recurrence);
    if v_kind = 'once' and public.next_due_date(v_did.recurrence, v_did.due_date, v_today - 1) is not null then
      insert into public.task_completions (task_id, folder_id, user_id, completed_at, cycle_key, prev_due_date)
      values (v_did.id, v_did.folder_id, v_user, v_at, 'r:' || gen_random_uuid(), v_did.due_date);
      update public.tasks set due_date = public.next_due_date(v_did.recurrence, v_did.due_date, v_today - 1)
      where id = v_did.id;
    else
      insert into public.task_completions (task_id, folder_id, user_id, completed_at, cycle_key)
      values (v_did.id, v_did.folder_id, v_user, v_at,
              public.cycle_key_for(v_kind, v_did.tz, v_at, v_did.manual_cycle))
      on conflict (task_id, cycle_key) do nothing;
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
                            'buff', case when v_perfect then v_p.buff_amount else 0 end);
end;
$$;
