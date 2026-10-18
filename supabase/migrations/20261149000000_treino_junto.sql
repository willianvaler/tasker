-- V6 §15.4 (AC10.1, D183): treinar junto. Todo Modo Treino aberto vira uma sessão no servidor
-- (sozinho ou com outras pessoas da pasta); a sessão guarda o exercício atual e o descanso (state)
-- e, com mais de uma pessoa, a contagem de séries do grupo (progress): a série vale para o grupo,
-- qualquer participante marca, e quem marca a última conclui a tarefa (XP dele, como em projeto).
-- Só online (não entra no PowerSync); o tempo real vai pelo Supabase Realtime.

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  started_by uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- { "task_id": exercício atual, "rest_ends_at": fim do descanso, "paused_at": ... } (do app)
  state jsonb not null default '{}'
    constraint workout_sessions_state_object check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 4096),
  -- { "<task_id>": { "reps": n, "values": [...] } }: as séries do grupo nesta sessão
  progress jsonb not null default '{}'
    constraint workout_sessions_progress_object check (jsonb_typeof(progress) = 'object'),
  updated_at timestamptz not null default now()
);
create index workout_sessions_page_idx on public.workout_sessions (page_id) where ended_at is null;

create table public.workout_session_members (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'left')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (session_id, user_id)
);
create index workout_session_members_user_idx on public.workout_session_members (user_id);

alter table public.workout_sessions enable row level security;
alter table public.workout_session_members enable row level security;
revoke insert, update, delete on public.workout_sessions, public.workout_session_members from anon, authenticated;

create function public.is_session_member(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.workout_session_members
                 where session_id = p_session_id and user_id = auth.uid());
$$;

create policy "workout_sessions_select" on public.workout_sessions for select to authenticated
  using (public.is_session_member(id));
create policy "workout_session_members_select" on public.workout_session_members for select to authenticated
  using (public.is_session_member(session_id));

alter publication supabase_realtime add table public.workout_sessions, public.workout_session_members;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested',
  'join_approved', 'task_ready', 'prereq_reopened', 'page_reminder', 'automation',
  'workout_invite', 'challenge_started'));

-- Sessão ativa em que eu estou dentro (joined); erro se não
create function public._my_active_session(p_session_id uuid)
returns public.workout_sessions
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.workout_sessions;
begin
  select s.* into v_session from public.workout_sessions s
  join public.workout_session_members m on m.session_id = s.id
  where s.id = p_session_id and m.user_id = auth.uid() and m.status = 'joined' and s.ended_at is null
  for update of s;
  if v_session.id is null or not public.is_folder_member(v_session.folder_id) then
    raise exception 'Sessão de treino não encontrada ou encerrada' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

-- Começa o treino na página, com quem está treinando junto (membros da pasta). Fecha a sessão
-- anterior que eu tinha aberta. Os convidados recebem o aviso (🔔 e push).
create function public.start_workout_session(p_page_id uuid, p_with uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_page public.pages;
  v_root uuid;
  v_id uuid;
  v_user uuid;
  v_name text;
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
  returning id into v_id;
  insert into public.workout_session_members (session_id, user_id, status, joined_at)
  values (v_id, v_uid, 'joined', now());

  select display_name into v_name from public.profiles where id = v_uid;
  for v_user in select distinct u from unnest(coalesce(p_with, '{}')) u where u is distinct from v_uid loop
    if not public._is_member_of(v_page.folder_id, v_user) then
      raise exception 'Só quem é da pasta pode treinar junto' using errcode = '22023';
    end if;
    insert into public.workout_session_members (session_id, user_id, status, invited_by)
    values (v_id, v_user, 'invited', v_uid);
    insert into public.notifications (user_id, kind, payload)
    values (v_user, 'workout_invite', jsonb_build_object(
      'by', v_name, 'page_name', v_page.name, 'page_id', v_page.id, 'session_id', v_id));
  end loop;
  return v_id;
end;
$$;

-- Membro da pasta (pela raiz), para outra pessoa que não eu
create function public._is_member_of(p_folder_id uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.folder_members fm
    join public.folders f on f.id = p_folder_id
    where fm.user_id = p_user and fm.folder_id = coalesce(f.parent_id, f.id));
$$;

create function public.join_workout_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.workout_session_members m set status = 'joined', joined_at = now(), left_at = null
  where m.session_id = p_session_id and m.user_id = auth.uid()
    and exists (select 1 from public.workout_sessions s where s.id = p_session_id and s.ended_at is null);
  if not found then
    raise exception 'Sessão de treino não encontrada ou encerrada' using errcode = 'P0002';
  end if;
  -- Uma sessão aberta por pessoa: sai das outras
  update public.workout_session_members m set status = 'left', left_at = now()
  where m.user_id = auth.uid() and m.session_id <> p_session_id and m.status = 'joined';
  update public.workout_sessions s set ended_at = now()
  where s.ended_at is null and s.id <> p_session_id
    and not exists (select 1 from public.workout_session_members m
                    where m.session_id = s.id and m.status = 'joined');
end;
$$;

-- Sair (ou recusar o convite). Sem ninguém dentro, a sessão termina.
create function public.leave_workout_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.workout_session_members set status = 'left', left_at = now()
  where session_id = p_session_id and user_id = auth.uid() and status <> 'left';
  update public.workout_sessions s set ended_at = now(), updated_at = now()
  where s.id = p_session_id and s.ended_at is null
    and not exists (select 1 from public.workout_session_members m
                    where m.session_id = s.id and m.status = 'joined');
end;
$$;

-- Exercício atual, descanso e pausa, iguais em todos os aparelhos da sessão
create function public.set_workout_state(p_session_id uuid, p_state jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._my_active_session(p_session_id);
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  update public.workout_sessions set state = state || p_state, updated_at = now() where id = p_session_id;
end;
$$;

-- Série do grupo: +1/−1 na contagem da sessão. A última série conclui a tarefa (quem marcou
-- leva o XP, como em projeto); desfazer a última reabre. Tarefa sem séries: +1 conclui, −1 reabre.
create function public.log_group_set(p_session_id uuid, p_task_id uuid, p_delta integer, p_values jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
$$;

-- Convites abertos para mim (o aviso "Fulano começou o treino com você: entrar")
create function public.my_workout_invites()
returns table (session_id uuid, page_id uuid, page_name text, by_name text, started_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.page_id, p.name, pr.display_name, s.started_at
  from public.workout_session_members m
  join public.workout_sessions s on s.id = m.session_id and s.ended_at is null
  join public.pages p on p.id = s.page_id
  left join public.profiles pr on pr.id = m.invited_by
  where m.user_id = auth.uid() and m.status = 'invited'
    and s.started_at > now() - interval '12 hours'
  order by s.started_at desc;
$$;

revoke execute on function public._my_active_session(uuid), public._is_member_of(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.start_workout_session(uuid, uuid[]), public.join_workout_session(uuid),
  public.leave_workout_session(uuid), public.set_workout_state(uuid, jsonb),
  public.log_group_set(uuid, uuid, integer, jsonb), public.my_workout_invites(), public.is_session_member(uuid)
  from public, anon;
grant execute on function public.start_workout_session(uuid, uuid[]), public.join_workout_session(uuid),
  public.leave_workout_session(uuid), public.set_workout_state(uuid, jsonb),
  public.log_group_set(uuid, uuid, integer, jsonb), public.my_workout_invites(), public.is_session_member(uuid)
  to authenticated;
