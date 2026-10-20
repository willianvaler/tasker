-- AC4 (V6 §3, D236): diário de treino. Cada série feita vira uma linha em `workout_sets`, com o
-- que aconteceu de verdade (carga em kg, reps, tempo, distância, aquecimento, esforço). Quem
-- grava é o servidor: `log_rep` e `log_group_set` (a série que conta) e `log_warmup` (o
-- aquecimento, que não conta série). O id vem do aparelho (`p_values.set_id`), então o reflexo
-- local e a linha do servidor são a mesma. A conta é de cada pessoa.

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- A tarefa pode ser apagada; o diário fica (com o nome e o exercício de quando foi feito)
  task_id uuid references public.tasks (id) on delete set null,
  page_id uuid references public.pages (id) on delete set null,
  session_id uuid references public.workout_sessions (id) on delete set null,
  exercise_id text check (char_length(exercise_id) <= 80),
  exercise_name text not null default '' check (char_length(exercise_name) <= 500),
  -- Ciclo da página quando foi feita (ou 'session:<id>' no treino junto): o desfazer tira a
  -- última deste ciclo
  cycle_key text not null default 'once',
  set_index integer not null default 1 check (set_index between 0 and 99),
  kind text not null default 'reps' check (kind in ('reps', 'time', 'cardio')),
  weight_kg numeric(7, 2) check (weight_kg between 0 and 2000),
  reps integer check (reps between 0 and 1000),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  distance_m numeric(9, 1) check (distance_m between 0 and 1000000),
  warmup boolean not null default false,
  effort numeric(3, 1),
  effort_scale text check (effort_scale in ('rir', 'rpe')),
  performed_at timestamptz not null default now(),
  constraint workout_sets_effort check (
    (effort is null and effort_scale is null)
    or (effort_scale = 'rir' and effort between 0 and 5 and effort = trunc(effort))
    or (effort_scale = 'rpe' and effort between 6 and 10 and effort * 2 = trunc(effort * 2)))
);
create index workout_sets_user_time on public.workout_sets (user_id, performed_at desc);
create index workout_sets_user_exercise on public.workout_sets (user_id, exercise_id, performed_at desc)
  where exercise_id is not null;
create index workout_sets_task on public.workout_sets (task_id, user_id, cycle_key);

alter table public.workout_sets enable row level security;
revoke insert, update, delete on public.workout_sets from anon, authenticated;
create policy "workout_sets_select" on public.workout_sets for select to authenticated
  using (user_id = (select auth.uid()));

alter publication powersync add table public.workout_sets;

-- "40kg", "20,5 kg", "100lb" → kg com duas casas (espelho de textToKg em lib/gym/units.ts)
create function public._set_weight_kg(p_text text)
returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when m is null then null
    when lower(m[2]) like 'lb%' then round(replace(m[1], ',', '.')::numeric * 0.45359237, 2)
    else round(replace(m[1], ',', '.')::numeric, 2)
  end
  from (select regexp_match(replace(coalesce(p_text, ''), ' ', ''), '^(\d{1,4}(?:[.,]\d{1,2})?)(kg|lb|lbs)$', 'i') as m) s;
$$;

-- Número do jsonb sem estourar com lixo do aparelho (texto estranho vira nulo)
create function public._json_num(p_value jsonb)
returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric
    when jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^\d{1,7}([.,]\d{1,2})?$'
      then replace(p_value #>> '{}', ',', '.')::numeric
  end;
$$;

-- Uma série no diário. Valor fora da faixa vira nulo (a série conta igual); esforço só numa
-- escala válida.
create function public._record_set(p_task public.tasks, p_values jsonb, p_cycle text,
                                   p_session uuid, p_index integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.workout_sets;
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
  on conflict (id) do nothing;
  return v.id;
end;
$$;

-- Desfazer a última série que conta (o aquecimento sai só por delete_workout_set). No treino
-- junto, a última do grupo, de quem tiver marcado.
create function public._unrecord_set(p_task_id uuid, p_cycle text, p_session uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.workout_sets
  where id = (select id from public.workout_sets
              where task_id = p_task_id and not warmup
                and (case when p_session is null then user_id = auth.uid() and cycle_key = p_cycle
                          else session_id = p_session end)
              order by performed_at desc, set_index desc limit 1);
$$;

-- Série de aquecimento: vai para o diário e não conta para o total, recorde nem progressão
create function public.log_warmup(p_task_id uuid, p_values jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not (public.is_folder_member(v_task.folder_id) or public.is_page_recipient(v_task.page_id)) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', public._record_set(v_task,
    coalesce(case when jsonb_typeof(p_values) = 'object' then p_values end, '{}') || '{"warmup": true}', 'warmup', null, 0));
end;
$$;

-- Apagar uma série do próprio diário (o aquecimento desfeito, ou uma correção no histórico)
create function public.delete_workout_set(p_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.workout_sets where id = p_id and user_id = auth.uid();
$$;

revoke execute on function public._record_set(public.tasks, jsonb, text, uuid, integer),
  public._unrecord_set(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.log_warmup(uuid, jsonb), public.delete_workout_set(uuid) from public, anon;
grant execute on function public.log_warmup(uuid, jsonb), public.delete_workout_set(uuid) to authenticated;

-- As séries que contam gravam o diário; desfazer tira a última
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
      v_result := public.complete_task(p_task_id);
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
      v_result := public.complete_task(p_task_id);
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

-- Aquecimento e apagar série também pela fila do aparelho
CREATE OR REPLACE FUNCTION public.run_once(p_key uuid, p_name text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.applied_ops (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'complete_tree' then
      return jsonb_build_object('count', public.complete_tree((p_args ->> 'p_task_id')::uuid));
    when 'start_task' then
      return to_jsonb(public.start_task((p_args ->> 'p_task_id')::uuid,
                                        coalesce((p_args ->> 'p_started')::boolean, true)));
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    when 'log_rep' then
      return public.log_rep((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                            p_args -> 'p_values');
    when 'start_timer' then
      return to_jsonb(public.start_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_kind',
                                         (p_args ->> 'p_started_at')::timestamptz,
                                         (p_args ->> 'p_seconds')::integer,
                                         (p_args ->> 'p_task_id')::uuid,
                                         coalesce(p_args -> 'p_config', '{}'),
                                         p_args ->> 'p_device'));
    when 'update_timer' then
      return to_jsonb(public.update_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_action',
                                          coalesce((p_args ->> 'p_seconds')::integer, 0),
                                          coalesce((p_args ->> 'p_at')::timestamptz, now())));
    when 'log_time' then
      return to_jsonb(public.log_time((p_args ->> 'p_id')::uuid, (p_args ->> 'p_task_id')::uuid,
                                      (p_args ->> 'p_minutes')::integer, (p_args ->> 'p_day')::date,
                                      p_args ->> 'p_note'));
    when 'check_item' then
      return public.check_item((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_done')::boolean,
                               p_args ->> 'p_note');
    when 'log_warmup' then
      return public.log_warmup((p_args ->> 'p_task_id')::uuid, p_args -> 'p_values');
    when 'delete_workout_set' then
      perform public.delete_workout_set((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    when 'delete_time_entry' then
      perform public.delete_time_entry((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$function$;

CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
                          where c.author_id = v_user), '[]'),
    -- V10: amigos (nick e desde quando) e o link de amizade
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', f.username, 'status', f.status, 'since', f.since))
                         from public.my_friends() f), '[]'),
    -- V10 §4: o que publiquei na comunidade (com a cópia), curtidas e denúncias
    'community_posts', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
                                 from public.community_posts c where c.author_id = v_user), '[]'),
    'community_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'at', l.created_at))
                                 from public.community_likes l where l.user_id = v_user), '[]'),
    'community_reports', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id')
                                   from public.community_reports r where r.user_id = v_user), '[]'),
    -- V6: o diário de treino (AC4)
    'workout_sets', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.performed_at)
                              from public.workout_sets w where w.user_id = v_user), '[]'),
    -- V6: exercícios próprios
    'user_exercises', coalesce((select jsonb_agg(to_jsonb(u) - 'owner_id' order by u.created_at)
                                from public.user_exercises u where u.owner_id = v_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;

-- Política de privacidade com o diário de treino (dado novo): todo mundo aceita de novo (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-20.2' $$;
