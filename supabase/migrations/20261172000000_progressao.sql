-- AC6 (V6 §5, D238): progressão automática. A próxima carga é derivada do diário no app
-- (lib/gym/progression.ts); aqui ficam a meta de cada série (para julgar a sessão) e a regra:
-- do treino (página) e, como exceção, do exercício, com o degrau próprio.

alter table public.workout_sets
  add column target_reps integer check (target_reps between 0 and 1000),
  add column target_sets integer check (target_sets between 0 and 99),
  add column target_seconds integer check (target_seconds between 0 and 86400);

-- null = a padrão do app (progressão dupla 8–12 nos treinos, V6 decisão 3)
alter table public.pages add column progression text
  check (progression in ('off', 'linear', 'double', 'greyskull', 'time'));
alter table public.tasks add column progression text
  check (progression in ('off', 'linear', 'double', 'greyskull', 'time')),
  add column progression_step numeric(5, 2) check (progression_step > 0 and progression_step <= 100);
grant insert (progression), update (progression) on public.pages to authenticated;
grant insert (progression, progression_step), update (progression, progression_step) on public.tasks to authenticated;

-- A série guarda a meta
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
                                   warmup, effort, effort_scale, target_reps, target_sets, target_seconds)
  values (v.id, auth.uid(), p_task.id, p_task.page_id, p_session, p_task.exercise_id, left(p_task.title, 500),
          coalesce(p_cycle, 'once'), least(greatest(coalesce(p_index, 1), 0), 99), v.kind, v.weight_kg, v.reps,
          v.duration_seconds, v.distance_m, coalesce((v_values ->> 'warmup')::boolean, false), v_effort, v_scale,
          -- A meta da série (AC6): o que o plano pedia, para a progressão julgar a sessão
          coalesce(public._json_num(v_values -> 'target_reps'), public._json_num(p_task.meta -> 'reps'))::integer,
          public._json_num(p_task.repeat_plan -> 'total')::integer,
          case when v.kind = 'time' then public._json_num(p_task.repeat_plan -> 'duration_seconds')::integer end)
  on conflict (id) do nothing
  returning * into v_row;
  -- Recordes (AC5): só na série nova (o reenvio da fila não recalcula)
  if v_row.id is not null then
    update public.workout_sets set records = public._set_records(v_row) where id = v_row.id;
  end if;
  return v.id;
end;
$function$;
