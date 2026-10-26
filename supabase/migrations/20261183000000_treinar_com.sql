-- AC15A (D252, D277): "Treinar com…" em qualquer treino. Além de quem é da pasta, dá para chamar
-- amigos e quem está nos mesmos times e grupos (projetos e os desafios deles). Quem vem de fora da
-- pasta é convidado da sessão: lê a página e as tarefas só enquanto está nela (convidado ou
-- dentro), marca a série do grupo com o próprio diário e recordes, e o dia de treino conta para
-- ele também (leave_workout_session). Quando o convidado marca a última série, a tarefa é
-- concluída em nome de quem começou o treino (a tarefa é dele; o XP da conclusão vai para ele).
-- Chamar gente no meio do treino (invite_to_workout_session) leva para a sessão as séries que a
-- pessoa já tinha feito sozinha neste ciclo.

-- ============================================================
-- Com quem dá para treinar
-- ============================================================
-- Da pasta da página primeiro, depois amigos, times e outros grupos. Só para quem é da pasta.
create function public.workout_partners(p_page_id uuid)
returns table (user_id uuid, display_name text, source text)
language sql stable security definer set search_path = ''
as $$
  with page as (
    select coalesce(f.parent_id, f.id) as root
    from public.pages p join public.folders f on f.id = p.folder_id
    where p.id = p_page_id and public.is_folder_member(p.folder_id)
  ),
  candidates as (
    select fm.user_id, 'folder' as source, 1 as rank
    from public.folder_members fm join page on fm.folder_id = page.root
    union all
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end, 'friend', 2
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_a, f.user_b)
    union all
    select o.user_id, 'team', 3
    from public.team_members t join public.team_members o on o.team_id = t.team_id
    where t.user_id = auth.uid()
    union all
    select o.user_id, 'group', 4
    from public.folder_members t
    join public.folders f on f.id = t.folder_id and f.parent_id is null
    join public.folder_members o on o.folder_id = t.folder_id
    where t.user_id = auth.uid() and (f.kind = 'project' or f.is_shared)
  )
  select c.user_id, pr.display_name, (array_agg(c.source order by c.rank))[1]
  from candidates c join public.profiles pr on pr.id = c.user_id
  where c.user_id <> auth.uid() and exists (select 1 from page)
  group by c.user_id, pr.display_name
  order by min(c.rank), pr.display_name
  limit 200;
$$;

-- Páginas das sessões em que estou (convidado ou dentro): a leitura do convidado
create function public.my_session_pages()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct s.page_id
  from public.workout_session_members m
  join public.workout_sessions s on s.id = m.session_id and s.ended_at is null
  where m.user_id = auth.uid() and m.status in ('invited', 'joined');
$$;

-- `in (select ...)` vira uma consulta só por leitura, não uma por linha
create policy "pages_select_session" on public.pages for select to authenticated
  using (id in (select public.my_session_pages()));
create policy "tasks_select_session" on public.tasks for select to authenticated
  using (page_id in (select public.my_session_pages()));

-- Quem está na sessão, com o nome (o convidado não lê os membros da pasta)
create function public.workout_session_people(p_session_id uuid)
returns table (user_id uuid, status text, display_name text)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, m.status, pr.display_name
  from public.workout_session_members m
  join public.profiles pr on pr.id = m.user_id
  where m.session_id = p_session_id and public.is_session_member(p_session_id)
  order by m.joined_at nulls last, pr.display_name;
$$;

-- ============================================================
-- Sessão
-- ============================================================
-- Sessão ativa em que eu estou dentro (joined); erro se não. Convidado de fora da pasta vale.
CREATE OR REPLACE FUNCTION public._my_active_session(p_session_id uuid)
 RETURNS public.workout_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.workout_sessions;
  v_invited boolean;
begin
  select s.* into v_session from public.workout_sessions s
  join public.workout_session_members m on m.session_id = s.id
  where s.id = p_session_id and m.user_id = auth.uid() and m.status = 'joined' and s.ended_at is null
  for update of s;
  select invited_by is not null into v_invited from public.workout_session_members
  where session_id = p_session_id and user_id = auth.uid();
  if v_session.id is null or not (v_invited or public.is_folder_member(v_session.folder_id)) then
    raise exception 'Sessão de treino não encontrada ou encerrada' using errcode = 'P0002';
  end if;
  return v_session;
end;
$function$;

-- As séries que eu já fiz sozinho neste ciclo entram na contagem do grupo (sem passar por cima
-- do que o grupo já marcou)
create function public._seed_session_progress(p_session_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.workout_sessions s
  set progress = coalesce((
        select jsonb_object_agg(tp.task_id::text, jsonb_build_object(
                 'reps', tp.done_reps, 'values', tp.logged_values, 'by', tp.user_id))
        from public.task_progress tp
        join public.tasks t on t.id = tp.task_id
        join public.pages p on p.id = t.page_id
        cross join lateral (select public.cycle_key_for(
                              public.task_cycle_kind(p.view_type, p.reset_cycle, t.recurrence),
                              public.folder_timezone(p.folder_id), now(), p.manual_cycle) as k) c
        where t.page_id = s.page_id and tp.user_id = auth.uid() and tp.done_reps > 0
          and t.status <> 'done'
          and tp.cycle_key = case when c.k is null or c.k like 'r:%' then 'once' else c.k end
      ), '{}') || s.progress,
      updated_at = now()
  where s.id = p_session_id;
$$;

-- Chama as pessoas (da pasta, amigos, times, grupos) e avisa cada uma (🔔 e push). Quem saiu e é
-- chamado de novo volta a ser convidado.
create function public._invite_to_session(p_session public.workout_sessions, p_with uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_name text;
  v_page_name text;
begin
  if cardinality(coalesce(p_with, '{}')) > 20 then
    raise exception 'No máximo 20 pessoas por treino' using errcode = '22023';
  end if;
  select display_name into v_name from public.profiles where id = auth.uid();
  select name into v_page_name from public.pages where id = p_session.page_id;
  for v_user in select distinct u from unnest(coalesce(p_with, '{}')) u where u is distinct from auth.uid() loop
    if not exists (select 1 from public.workout_partners(p_session.page_id) w where w.user_id = v_user) then
      raise exception 'Só amigos e gente dos seus times e grupos podem treinar junto' using errcode = '22023';
    end if;
    insert into public.workout_session_members (session_id, user_id, status, invited_by)
    values (p_session.id, v_user, 'invited', auth.uid())
    on conflict (session_id, user_id) do update
      set status = 'invited', invited_by = excluded.invited_by, left_at = null
      where public.workout_session_members.status = 'left';
    if found then
      insert into public.notifications (user_id, kind, payload)
      values (v_user, 'workout_invite', jsonb_build_object(
        'by', v_name, 'page_name', v_page_name, 'page_id', p_session.page_id, 'session_id', p_session.id));
    end if;
  end loop;
end;
$$;

-- Começa o treino na página, com quem está treinando junto. Fecha a sessão anterior que eu tinha
-- aberta.
CREATE OR REPLACE FUNCTION public.start_workout_session(p_page_id uuid, p_with uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_page public.pages;
  v_session public.workout_sessions;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id) then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if cardinality(coalesce(p_with, '{}')) > 20 then
    raise exception 'No máximo 20 pessoas por treino' using errcode = '22023';
  end if;

  -- Uma sessão aberta por pessoa: sair da anterior
  update public.workout_session_members m set status = 'left', left_at = now()
  where m.user_id = v_uid and m.status <> 'left'
    and exists (select 1 from public.workout_sessions s where s.id = m.session_id and s.ended_at is null);
  update public.workout_sessions s set ended_at = now()
  where s.ended_at is null
    and not exists (select 1 from public.workout_session_members m
                    where m.session_id = s.id and m.status = 'joined');

  insert into public.workout_sessions (page_id, folder_id, started_by)
  values (v_page.id, v_page.folder_id, v_uid)
  returning * into v_session;
  insert into public.workout_session_members (session_id, user_id, status, joined_at)
  values (v_session.id, v_uid, 'joined', now());

  if cardinality(array_remove(coalesce(p_with, '{}'), v_uid)) > 0 then
    perform public._invite_to_session(v_session, p_with);
    perform public._seed_session_progress(v_session.id);
  end if;
  return v_session.id;
end;
$function$;

-- Chamar gente no meio do treino (quem está dentro chama)
create function public.invite_to_workout_session(p_session_id uuid, p_with uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.workout_sessions;
begin
  v_session := public._my_active_session(p_session_id);
  if not public.is_folder_member(v_session.folder_id) then
    raise exception 'Só quem é da pasta chama mais gente' using errcode = '42501';
  end if;
  perform public._invite_to_session(v_session, p_with);
  perform public._seed_session_progress(p_session_id);
end;
$$;

-- Roda o que vem a seguir como outra pessoa (até _restore_actor): a conclusão que o convidado
-- dispara é de quem começou o treino. Vale só nesta transação.
create function public._act_as(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_previous jsonb := jsonb_build_object(
    'claims', current_setting('request.jwt.claims', true),
    'sub', current_setting('request.jwt.claim.sub', true));
begin
  perform set_config('request.jwt.claims',
                     jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  return v_previous;
end;
$$;

create function public._restore_actor(p_previous jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', coalesce(p_previous ->> 'claims', ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(p_previous ->> 'sub', ''), true);
end;
$$;

-- Série do grupo. O diário é de quem marcou; a conclusão, de quem marcou (da pasta) ou, se foi
-- um convidado de fora, de quem começou o treino.
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
  v_guest boolean;
  v_previous jsonb;
begin
  v_session := public._my_active_session(p_session_id);
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or v_task.page_id <> v_session.page_id then
    raise exception 'Tarefa não é deste treino' using errcode = 'P0002';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  v_guest := not public.is_folder_member(v_task.folder_id);
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
      if v_guest then
        v_previous := public._act_as(v_session.started_by);
        perform public.complete_task(p_task_id);
        perform public._restore_actor(v_previous);
      else
        v_result := public.complete_task(p_task_id);
      end if;
      perform set_config('app.force_crit', 'off', true);
    end if;
  else
    if v_reps = 0 then
      return jsonb_build_object('done_reps', 0, 'total', v_total, 'completed', false);
    end if;
    if v_task.status = 'done' and v_guest then
      v_previous := public._act_as(coalesce(v_task.completed_by, v_session.started_by));
      perform public.uncomplete_task(p_task_id);
      perform public._restore_actor(v_previous);
    elsif v_task.status = 'done' then
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

revoke execute on function public._seed_session_progress(uuid),
  public._invite_to_session(public.workout_sessions, uuid[]), public._act_as(uuid),
  public._restore_actor(jsonb) from public, anon, authenticated;
revoke execute on function public.workout_partners(uuid), public.my_session_pages(),
  public.workout_session_people(uuid), public.invite_to_workout_session(uuid, uuid[]) from public, anon;
grant execute on function public.workout_partners(uuid), public.my_session_pages(),
  public.workout_session_people(uuid), public.invite_to_workout_session(uuid, uuid[]) to authenticated;
