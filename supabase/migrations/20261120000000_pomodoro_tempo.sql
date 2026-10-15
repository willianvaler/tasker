-- V3 §5 (K1): pomodoro e registro de tempo. O pomodoro é um timer (`kind = 'pomodoro'`, fase no
-- config: focus/short/long). Quando um foco termina de verdade (o servidor confere o horário), vira
-- uma linha de `time_entries` (fonte 'pomodoro'); o cronômetro e o lançamento manual (K3) usam a
-- mesma tabela. `tasks.actual_minutes` é a soma, mantida por trigger.

-- ---------- Configuração do pomodoro (do usuário) ----------
create table public.pomodoro_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  focus_minutes integer not null default 25 check (focus_minutes between 1 and 180),
  short_break_minutes integer not null default 5 check (short_break_minutes between 1 and 60),
  long_break_minutes integer not null default 15 check (long_break_minutes between 1 and 120),
  cycles integer not null default 4 check (cycles between 1 and 12),
  auto_start boolean not null default false,
  -- Sugestões de pausa do usuário; null = as padrão do idioma (K2)
  break_ideas jsonb check (
    break_ideas is null or (jsonb_typeof(break_ideas) = 'array' and jsonb_array_length(break_ideas) <= 30)
  ),
  idea_order text not null default 'random' check (idea_order in ('random', 'sequence')),
  updated_at timestamptz not null default now()
);
alter table public.pomodoro_settings enable row level security;
create policy "pomodoro_settings: as minhas" on public.pomodoro_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update on public.pomodoro_settings from anon, authenticated;
grant insert (focus_minutes, short_break_minutes, long_break_minutes, cycles, auto_start, break_ideas, idea_order),
      update (focus_minutes, short_break_minutes, long_break_minutes, cycles, auto_start, break_ideas, idea_order, updated_at)
  on public.pomodoro_settings to authenticated;

-- ---------- Tempo registrado ----------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  -- Pasta da tarefa (trigger), para o relatório do projeto e o sync
  folder_id uuid references public.folders (id) on delete cascade,
  source text not null check (source in ('pomodoro', 'stopwatch', 'manual')),
  -- O timer que gerou (um registro por timer, mesmo se o "feito" chegar duas vezes)
  timer_id uuid unique,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null check (minutes between 1 and 1440),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
create index time_entries_task on public.time_entries (task_id);
create index time_entries_user_day on public.time_entries (user_id, started_at desc);
create index time_entries_folder on public.time_entries (folder_id);

alter table public.time_entries enable row level security;
-- Os meus e, nas pastas de que sou membro, os dos outros (relatório do projeto)
create policy "time_entries: os meus e os da pasta" on public.time_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or (folder_id is not null and public.is_folder_member(folder_id)));
revoke insert, update, delete on public.time_entries from anon, authenticated;

alter publication powersync add table public.time_entries;

create function public.time_entries_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.task_id is not null then
    select t.folder_id into new.folder_id from public.tasks t where t.id = new.task_id;
  else
    new.folder_id := null;
  end if;
  return new;
end;
$$;
create trigger time_entries_fill before insert on public.time_entries
  for each row execute function public.time_entries_fill();

-- Minutos feitos na tarefa (soma de tudo, de todos)
alter table public.tasks add column actual_minutes integer not null default 0;

create function public.time_entries_sum()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
begin
  if v_task is not null then
    update public.tasks
    set actual_minutes = coalesce((select sum(minutes) from public.time_entries where task_id = v_task), 0)
    where id = v_task;
  end if;
  return null;
end;
$$;
create trigger time_entries_sum after insert or delete on public.time_entries
  for each row execute function public.time_entries_sum();

-- Tarefa movida de pasta: os registros vão junto
create function public.tasks_move_time_entries()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.time_entries set folder_id = new.folder_id where task_id = new.id;
  return null;
end;
$$;
create trigger tasks_move_time_entries
  after update of folder_id on public.tasks
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.tasks_move_time_entries();

-- ---------- Timers: duração pedida e o que acontece ao terminar ----------
alter table public.timers add column duration_seconds integer check (duration_seconds between 1 and 86400);

create or replace function public.start_timer(
  p_id uuid, p_kind text, p_started_at timestamptz, p_seconds integer default null,
  p_task_id uuid default null, p_config jsonb default '{}', p_device text default null
)
returns public.timers
language plpgsql security definer set search_path = ''
as $$
declare
  v_timer public.timers;
  v_active public.timers;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  select * into v_timer from public.timers where id = p_id;
  if v_timer.id is not null then
    if v_timer.user_id <> auth.uid() then
      raise exception 'Temporizador não encontrado' using errcode = 'P0002';
    end if;
    return v_timer;
  end if;
  if p_kind <> 'stopwatch' and (p_seconds is null or p_seconds not between 1 and 86400) then
    raise exception 'Duração inválida' using errcode = '22023';
  end if;
  if p_task_id is not null and not exists (
    select 1 from public.tasks t where t.id = p_task_id and public.is_folder_member(t.folder_id)
  ) then
    p_task_id := null;
  end if;

  select * into v_active from public.timers
  where user_id = auth.uid() and state in ('running', 'paused') for update;
  if v_active.id is not null and v_active.started_at > p_started_at then
    insert into public.timers (id, user_id, task_id, kind, state, started_at, ends_at, ended_at, device_id, config,
                               duration_seconds)
    values (p_id, auth.uid(), p_task_id, p_kind, 'cancelled', p_started_at,
            p_started_at + make_interval(secs => coalesce(p_seconds, 0)), p_started_at, p_device,
            coalesce(p_config, '{}'), case when p_kind <> 'stopwatch' then p_seconds end)
    returning * into v_timer;
    return v_timer;
  end if;
  if v_active.id is not null then
    -- O cronômetro que estava rodando guarda o tempo dele (não se perde ao iniciar outro)
    perform public.update_timer(v_active.id, case when v_active.kind = 'stopwatch' then 'done' else 'cancel' end,
                                0, p_started_at);
  end if;

  insert into public.timers (id, user_id, task_id, kind, started_at, ends_at, device_id, config, duration_seconds)
  values (p_id, auth.uid(), p_task_id, p_kind, p_started_at,
          case when p_kind <> 'stopwatch' then p_started_at + make_interval(secs => p_seconds) end,
          p_device, coalesce(p_config, '{}'), case when p_kind <> 'stopwatch' then p_seconds end)
  returning * into v_timer;
  return v_timer;
end;
$$;

-- Timer terminado como "feito": foco de pomodoro que chegou ao fim e cronômetro de tarefa viram
-- tempo registrado. O servidor confere o horário: foco "feito" antes do fim não conta.
-- Recebe o id (com a linha como parâmetro, o PostgREST a exporia como coluna calculada)
create function public._timer_finished(p_timer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p_timer public.timers;
  v_minutes integer;
begin
  select * into p_timer from public.timers where id = p_timer_id;
  if p_timer.id is null or p_timer.state <> 'done' then
    return;
  end if;
  if p_timer.kind = 'pomodoro' and coalesce(p_timer.config ->> 'phase', 'focus') = 'focus' then
    if now() < p_timer.ends_at - interval '5 seconds' or p_timer.duration_seconds is null then
      return;
    end if;
    v_minutes := greatest(1, round(p_timer.duration_seconds / 60.0)::integer);
  elsif p_timer.kind = 'stopwatch' and p_timer.task_id is not null then
    -- Menos de meio minuto não vira registro (toque sem querer)
    if extract(epoch from p_timer.ends_at - p_timer.started_at) < 30 then
      return;
    end if;
    v_minutes := least(1440, greatest(1, round(extract(epoch from p_timer.ends_at - p_timer.started_at) / 60.0)::integer));
  else
    return;
  end if;
  insert into public.time_entries (user_id, task_id, source, timer_id, started_at, ended_at, minutes)
  values (p_timer.user_id,
          case when p_timer.task_id is not null and exists (select 1 from public.tasks where id = p_timer.task_id)
               then p_timer.task_id end,
          case when p_timer.kind = 'pomodoro' then 'pomodoro' else 'stopwatch' end,
          p_timer.id, p_timer.started_at, greatest(p_timer.ends_at, p_timer.started_at), v_minutes)
  on conflict (timer_id) do nothing;
end;
$$;
revoke execute on function public._timer_finished(uuid) from public, anon, authenticated;

create or replace function public.update_timer(p_id uuid, p_action text, p_seconds integer default 0, p_at timestamptz default now())
returns public.timers
language plpgsql security definer set search_path = ''
as $$
declare
  v_timer public.timers;
begin
  select * into v_timer from public.timers where id = p_id and user_id = auth.uid() for update;
  if v_timer.id is null then
    raise exception 'Temporizador não encontrado' using errcode = 'P0002';
  end if;
  if v_timer.state not in ('running', 'paused') then
    return v_timer;
  end if;

  case p_action
    when 'adjust' then
      if v_timer.kind = 'stopwatch' then
        raise exception 'O cronômetro não tem fim para ajustar' using errcode = '22023';
      end if;
      if v_timer.state = 'paused' then
        v_timer.paused_seconds := greatest(v_timer.paused_seconds + p_seconds, 1);
      else
        v_timer.ends_at := greatest(v_timer.ends_at + make_interval(secs => p_seconds), p_at);
      end if;
    when 'pause' then
      if v_timer.state = 'running' then
        v_timer.state := 'paused';
        v_timer.paused_seconds := case
          when v_timer.kind = 'stopwatch' then greatest(0, extract(epoch from p_at - v_timer.started_at))::integer
          else greatest(1, ceil(extract(epoch from v_timer.ends_at - p_at)))::integer end;
      end if;
    when 'resume' then
      if v_timer.state = 'paused' then
        v_timer.state := 'running';
        if v_timer.kind = 'stopwatch' then
          v_timer.started_at := p_at - make_interval(secs => v_timer.paused_seconds);
        else
          v_timer.ends_at := p_at + make_interval(secs => v_timer.paused_seconds);
        end if;
        v_timer.paused_seconds := null;
      end if;
    when 'done', 'skip', 'cancel' then
      v_timer.state := case p_action when 'done' then 'done' when 'skip' then 'skipped' else 'cancelled' end;
      v_timer.ended_at := p_at;
      if v_timer.kind = 'stopwatch' then
        v_timer.ends_at := case when v_timer.paused_seconds is not null
                                then v_timer.started_at + make_interval(secs => v_timer.paused_seconds)
                                else p_at end;
      end if;
    else
      raise exception 'Ação desconhecida: %', p_action using errcode = '22023';
  end case;

  update public.timers
  set state = v_timer.state, ends_at = v_timer.ends_at, started_at = v_timer.started_at,
      paused_seconds = v_timer.paused_seconds, ended_at = v_timer.ended_at, updated_at = now()
  where id = p_id
  returning * into v_timer;
  perform public._timer_finished(v_timer.id);
  return v_timer;
end;
$$;
