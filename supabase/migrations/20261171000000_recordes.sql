-- AC5 (V6 §4, D237): recordes pessoais e 1RM. Cada série do diário guarda os recordes que bateu
-- (`records`), pelas mesmas regras de lib/gym/records.ts; um recorde no exercício faz o golpe da
-- conclusão ser crítico garantido (V6 §9).

alter table public.workout_sets add column records text[] not null default '{}'
  check (records <@ array['weight', 'reps', 'one_rm', 'volume', 'duration', 'distance']);

-- 1RM estimado (Epley, até 12 repetições; uma é a própria carga). Espelho de estimate1Rm.
create function public._e1rm(p_weight numeric, p_reps integer)
returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when p_weight is null or p_reps is null or p_weight <= 0 or p_reps < 1 or p_reps > 12 then null
    when p_reps = 1 then round(p_weight, 2)
    else round(p_weight * (1 + p_reps / 30.0), 2)
  end;
$$;

-- As outras séries do mesmo exercício (o ligado ou, sem ele, o item), sem aquecimento, com o dia
create function public._prev_sets(p_set public.workout_sets, p_tz text)
returns table (weight_kg numeric, reps integer, duration_seconds integer, distance_m numeric, day date)
language sql stable security definer set search_path = ''
as $$
  select w.weight_kg, w.reps, w.duration_seconds, w.distance_m, (w.performed_at at time zone p_tz)::date
  from public.workout_sets w
  where w.user_id = p_set.user_id and w.id <> p_set.id and not w.warmup
    and (case when p_set.exercise_id is not null then w.exercise_id = p_set.exercise_id
              else w.exercise_id is null and w.task_id = p_set.task_id end);
$$;
revoke execute on function public._prev_sets(public.workout_sets, text) from public, anon, authenticated;

-- Os recordes que a série bate. Espelho de setRecords (lib/gym/records.ts), com os mesmos casos
create function public._set_records(p_set public.workout_sets)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := coalesce((select timezone from public.profiles where id = p_set.user_id), 'UTC');
  v_day date := (p_set.performed_at at time zone v_tz)::date;
  v_out text[] := '{}';
  v_reps integer := coalesce(p_set.reps, 0);
  v_vol numeric := coalesce(p_set.weight_kg, 0) * coalesce(p_set.reps, 0);
  v record;
begin
  if p_set.warmup then
    return v_out;
  end if;
  select count(*) as n,
         max(p.weight_kg) filter (where coalesce(p.reps, 0) >= 1) as best_weight,
         max(p.reps) filter (where p.weight_kg is not distinct from p_set.weight_kg) as best_reps,
         max(public._e1rm(p.weight_kg, p.reps)) as best_1rm,
         coalesce(sum(coalesce(p.weight_kg, 0) * coalesce(p.reps, 0)) filter (where p.day = v_day), 0) as today_vol,
         max(p.duration_seconds) as best_duration,
         max(p.distance_m) as best_distance
  into v
  from public._prev_sets(p_set, v_tz) p;
  if v.n = 0 then
    return v_out;
  end if;
  if p_set.weight_kg is not null and v_reps >= 1 and p_set.weight_kg > v.best_weight then
    v_out := v_out || 'weight'::text;
  end if;
  if v_reps >= 1 and v_reps > v.best_reps then
    v_out := v_out || 'reps'::text;
  end if;
  if public._e1rm(p_set.weight_kg, p_set.reps) > v.best_1rm then
    v_out := v_out || 'one_rm'::text;
  end if;
  if v_vol > 0 and exists (
    select 1 from (select sum(coalesce(weight_kg, 0) * coalesce(reps, 0)) as total
                   from public._prev_sets(p_set, v_tz) where day <> v_day group by day) d
    having max(d.total) > 0 and v.today_vol <= max(d.total) and v.today_vol + v_vol > max(d.total)) then
    v_out := v_out || 'volume'::text;
  end if;
  if p_set.duration_seconds > v.best_duration then
    v_out := v_out || 'duration'::text;
  end if;
  if p_set.distance_m > v.best_distance then
    v_out := v_out || 'distance'::text;
  end if;
  return v_out;
end;
$$;
revoke execute on function public._set_records(public.workout_sets) from public, anon, authenticated;

-- Recorde no exercício (deste ciclo ou desta sessão): o golpe da conclusão é crítico garantido
create function public._force_record_crit(p_task_id uuid, p_cycle text, p_session uuid)
returns void
language sql security definer set search_path = ''
as $$
  select set_config('app.force_crit',
    case when exists (select 1 from public.workout_sets
                      where task_id = p_task_id and records <> '{}'
                        and (case when p_session is null then user_id = auth.uid() and cycle_key = p_cycle
                                  else session_id = p_session end))
         then 'on' else 'off' end, true);
$$;
revoke execute on function public._force_record_crit(uuid, text, uuid) from public, anon, authenticated;

-- A série grava os recordes que bateu
CREATE OR REPLACE FUNCTION public._record_set(p_task tasks, p_values jsonb, p_cycle text, p_session uuid, p_index integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.workout_sets;
  v_row public.workout_sets;
  v_values jsonb := case when jsonb_typeof(p_values) = 'object' then p_values else '{}' end;
  v_scale text := v_values ->> 'effort_scale';
  v_effort numeric := public._json_num(v_values -> 'effort');
begin
  v.id := case when (v_values ->> 'set_id') ~* '^[0-9a-f-]{36}$' then (v_values ->> 'set_id')::uuid
               else gen_random_uuid() end;
  v.kind := case when v_values ->> 'kind' in ('reps', 'time', 'cardio') then v_values ->> 'kind'
                 when p_task.repeat_plan ->> 'mode' = 'timed' then 'time'
                 else 'reps' end;
  v.weight_kg := coalesce(public._json_num(v_values -> 'weight_kg'), public._set_weight_kg(v_values ->> 'weight'));
  v.reps := public._json_num(v_values -> 'reps');
  v.duration_seconds := coalesce(public._json_num(v_values -> 'duration_seconds'),
                                 case when v.kind = 'time' then public._json_num(p_task.repeat_plan -> 'duration_seconds') end);
  v.distance_m := public._json_num(v_values -> 'distance_m');
  if v.weight_kg not between 0 and 2000 then v.weight_kg := null; end if;
  if v.reps not between 0 and 1000 or v.reps <> trunc(v.reps) then v.reps := null; end if;
  if v.duration_seconds not between 0 and 86400 then v.duration_seconds := null; end if;
  if v.distance_m not between 0 and 1000000 then v.distance_m := null; end if;
  if not ((v_scale = 'rir' and v_effort between 0 and 5 and v_effort = trunc(v_effort))
          or (v_scale = 'rpe' and v_effort between 6 and 10 and v_effort * 2 = trunc(v_effort * 2))) then
    v_scale := null;
    v_effort := null;
  end if;
  insert into public.workout_sets (id, user_id, task_id, page_id, session_id, exercise_id, exercise_name,
                                   cycle_key, set_index, kind, weight_kg, reps, duration_seconds, distance_m,
                                   warmup, effort, effort_scale)
  values (v.id, auth.uid(), p_task.id, p_task.page_id, p_session, p_task.exercise_id, left(p_task.title, 500),
          coalesce(p_cycle, 'once'), least(greatest(coalesce(p_index, 1), 0), 99), v.kind, v.weight_kg, v.reps,
          v.duration_seconds, v.distance_m, coalesce((v_values ->> 'warmup')::boolean, false), v_effort, v_scale)
  on conflict (id) do nothing
  returning * into v_row;
  -- Recordes (AC5): só na série nova (o reenvio da fila não recalcula)
  if v_row.id is not null then
    update public.workout_sets set records = public._set_records(v_row) where id = v_row.id;
  end if;
  return v.id;
end;
$function$;

-- Recorde no exercício: a conclusão é crítico garantido
CREATE OR REPLACE FUNCTION public.log_rep(p_task_id uuid, p_delta integer, p_values jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_task public.tasks;
  v_page public.pages;
  v_total integer;
  v_key text;
  v_progress public.task_progress;
  v_current integer;
  v_new integer;
  v_values jsonb;
  v_result jsonb := '{}';
  v_waiting uuid[];
  -- Página recebida ao vivo: a conclusão é do aluno (share_checks), não da tarefa (D134)
  v_recipient boolean;
  v_done boolean;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  v_recipient := v_task.id is not null and not public.is_folder_member(v_task.folder_id)
                 and public.is_page_recipient(v_task.page_id);
  if v_task.id is null or not (v_recipient or public.is_folder_member(v_task.folder_id)) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not v_recipient and not public.has_permission(v_task.folder_id, 'task.complete',
                               public.is_task_assignee(v_task.id, auth.uid()), v_task.created_by = auth.uid()) then
    raise exception 'Seu cargo não conclui esta tarefa' using errcode = '42501';
  end if;
  if v_task.repeat_plan is null then
    raise exception 'Esta tarefa não tem repetições' using errcode = '22023';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  v_total := (v_task.repeat_plan ->> 'total')::integer;

  select * into v_page from public.pages where id = v_task.page_id;
  v_key := public.cycle_key_for(
    public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence),
    public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  if v_key is null or v_key like 'r:%' then
    v_key := 'once';
  end if;

  select * into v_progress from public.task_progress where task_id = p_task_id and user_id = auth.uid();
  if v_progress.cycle_key is distinct from v_key then
    v_progress.done_reps := 0;
    v_progress.logged_values := '[]';
  end if;
  v_done := case when v_recipient
                 then exists (select 1 from public.share_checks
                              where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key)
                 else v_task.status = 'done' end;
  v_current := case when v_done then v_total
                    else least(coalesce(v_progress.done_reps, 0), v_total - 1) end;
  v_values := coalesce(v_progress.logged_values, '[]');

  if p_delta = 1 then
    if v_done then
      return jsonb_build_object('done_reps', v_total, 'total', v_total, 'completed', true);
    end if;
    -- Tarefa bloqueada não começa (a mesma regra do guarda de iniciar/concluir)
    if v_current = 0 and current_setting('app.force_unblock', true) is distinct from v_task.id::text then
      v_waiting := public.task_blockers(v_task.id);
      if cardinality(v_waiting) > 0 then
        raise exception 'Tarefa bloqueada. Aguardando: %',
          (select string_agg(title, ', ') from public.tasks where id = any (v_waiting))
          using errcode = '22023';
      end if;
      if cardinality(public.page_blockers(v_task.page_id)) > 0 then
        raise exception 'Lista bloqueada' using errcode = '22023';
      end if;
    end if;
    v_new := v_current + 1;
    v_values := v_values || jsonb_build_array(coalesce(p_values, '{}'));
    -- O diário (AC4): a série como aconteceu
    perform public._record_set(v_task, p_values, v_key, null, v_new);
    if v_new >= v_total and v_recipient then
      perform public.check_item(p_task_id, true);
    elsif v_new >= v_total then
      perform public._force_record_crit(p_task_id, v_key, null);
      v_result := public.complete_task(p_task_id);
      perform set_config('app.force_crit', 'off', true);
      -- Recorrente comum: concluir avança a data e a tarefa segue aberta, com a conta zerada
      if (select status from public.tasks where id = p_task_id) <> 'done' then
        v_new := 0;
        v_values := '[]';
      end if;
    end if;
  else
    if v_done or v_current > 0 then
      perform public._unrecord_set(p_task_id, v_key, null);
    end if;
    if v_done and v_recipient then
      perform public.check_item(p_task_id, false);
      v_new := v_total - 1;
    elsif v_done then
      v_result := public.uncomplete_task(p_task_id);
      v_new := v_total - 1;
    else
      v_new := greatest(v_current - 1, 0);
    end if;
    if jsonb_array_length(v_values) > 0 then
      v_values := v_values - (jsonb_array_length(v_values) - 1);
    end if;
  end if;

  insert into public.task_progress (task_id, user_id, done_reps, logged_values, cycle_key, updated_at)
  values (p_task_id, auth.uid(), v_new, v_values, v_key, now())
  on conflict (task_id, user_id) do update
  set done_reps = excluded.done_reps, logged_values = excluded.logged_values,
      cycle_key = excluded.cycle_key, updated_at = excluded.updated_at;

  -- Aluno: a conclusão guarda as séries desta vez (a última incluída) para a evolução do autor
  if v_recipient then
    update public.share_checks set values = v_values
    where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key;
  end if;
  v_done := case when v_recipient
                 then exists (select 1 from public.share_checks
                              where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key)
                 else (select status from public.tasks where id = p_task_id) = 'done' end;
  return coalesce(v_result, '{}') || jsonb_build_object(
    'done_reps', case when v_done then v_total else v_new end,
    'total', v_total,
    'completed', v_done);
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_group_set(p_session_id uuid, p_task_id uuid, p_delta integer, p_values jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.workout_sessions;
  v_task public.tasks;
  v_total integer;
  v_entry jsonb;
  v_reps integer;
  v_values jsonb;
  v_result jsonb := '{}';
begin
  v_session := public._my_active_session(p_session_id);
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or v_task.page_id <> v_session.page_id then
    raise exception 'Tarefa não é deste treino' using errcode = 'P0002';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  v_total := coalesce((v_task.repeat_plan ->> 'total')::integer, 1);
  v_entry := coalesce(v_session.progress -> p_task_id::text, '{}');
  v_reps := least(coalesce((v_entry ->> 'reps')::integer, 0), v_total);
  v_values := coalesce(v_entry -> 'values', '[]');
  if v_task.status = 'done' then
    v_reps := v_total;
  end if;

  if p_delta = 1 then
    if v_reps >= v_total then
      return jsonb_build_object('done_reps', v_total, 'total', v_total, 'completed', true);
    end if;
    v_reps := v_reps + 1;
    v_values := v_values || jsonb_build_array(coalesce(p_values, '{}'));
    perform public._record_set(v_task, p_values, 'session:' || p_session_id, p_session_id, v_reps);
    if v_reps >= v_total then
      perform public._force_record_crit(p_task_id, null, p_session_id);
      v_result := public.complete_task(p_task_id);
      perform set_config('app.force_crit', 'off', true);
    end if;
  else
    if v_reps = 0 then
      return jsonb_build_object('done_reps', 0, 'total', v_total, 'completed', false);
    end if;
    if v_task.status = 'done' then
      v_result := public.uncomplete_task(p_task_id);
    end if;
    perform public._unrecord_set(p_task_id, null, p_session_id);
    v_reps := v_reps - 1;
    if jsonb_array_length(v_values) > 0 then
      v_values := v_values - (jsonb_array_length(v_values) - 1);
    end if;
  end if;

  update public.workout_sessions
  set progress = progress || jsonb_build_object(p_task_id::text,
        jsonb_build_object('reps', v_reps, 'values', v_values, 'by', auth.uid())),
      updated_at = now()
  where id = p_session_id;
  return coalesce(v_result, '{}') || jsonb_build_object(
    'done_reps', v_reps, 'total', v_total, 'completed', v_reps >= v_total);
end;
$function$;

CREATE OR REPLACE FUNCTION public._attack(p_user uuid, p_category text, p_base numeric, p_overdue boolean, OUT damage integer, OUT crit boolean)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Recorde pessoal no exercício (AC5): crítico garantido
  crit := random() < v_chance or coalesce(current_setting('app.force_crit', true), '') = 'on';
  if crit then
    v_mult := v_mult * case when v_p.class = 'arqueiro' then (v_s ->> 'archerCritMultiplier')::numeric
                            else (v_d ->> 'critMultiplier')::numeric end;
  end if;
  damage := greatest(1, round(p_base * v_mult))::integer;
end;
$function$;
