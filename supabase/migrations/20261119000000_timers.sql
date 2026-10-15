-- V3 §4.2 (J2): temporizadores. O que vale é o horário absoluto (`ends_at`), nunca uma contagem
-- no aparelho: ao voltar ao app, o restante sai de ends_at − agora. Um ativo (rodando ou pausado)
-- por pessoa, sincronizado entre os aparelhos dela.
--
-- Só RPCs mudam (também pela fila do aparelho, via run_once), com o horário do aparelho: offline,
-- quem iniciou por último vence. O descanso (J3), o pomodoro e o cronômetro (K) usam esta tabela.

create table public.timers (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  kind text not null check (kind in ('rest', 'pomodoro', 'stopwatch', 'countdown')),
  state text not null default 'running' check (state in ('running', 'paused', 'done', 'skipped', 'cancelled')),
  started_at timestamptz not null,
  -- Fim previsto; o cronômetro (conta para cima) não tem
  ends_at timestamptz,
  -- Pausado: quanto faltava (ou, no cronômetro, quanto já tinha passado)
  paused_seconds integer check (paused_seconds >= 0),
  ended_at timestamptz,
  device_id text check (char_length(device_id) <= 100),
  -- Rótulo e o que fazer ao fim ({"label": "Supino reto, 3/4"}), livre para cada tipo
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 4000),
  updated_at timestamptz not null default now(),
  check (kind = 'stopwatch' or ends_at is not null),
  check (state <> 'paused' or paused_seconds is not null)
);
create unique index timers_one_active on public.timers (user_id) where state in ('running', 'paused');
create index timers_user on public.timers (user_id, started_at desc);

alter table public.timers enable row level security;
create policy "timers: os meus" on public.timers
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.timers from anon, authenticated;

alter publication powersync add table public.timers;

-- Inicia (id gerado no aparelho; repetir o mesmo id não cria outro). O ativo de antes termina como
-- cancelado; se ele começou depois deste (comando atrasado de um aparelho offline), este já nasce
-- cancelado.
create function public.start_timer(
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
    insert into public.timers (id, user_id, task_id, kind, state, started_at, ends_at, ended_at, device_id, config)
    values (p_id, auth.uid(), p_task_id, p_kind, 'cancelled', p_started_at,
            p_started_at + make_interval(secs => coalesce(p_seconds, 0)), p_started_at, p_device,
            coalesce(p_config, '{}'))
    returning * into v_timer;
    return v_timer;
  end if;
  if v_active.id is not null then
    update public.timers set state = 'cancelled', ended_at = p_started_at, updated_at = now()
    where id = v_active.id;
  end if;

  insert into public.timers (id, user_id, task_id, kind, started_at, ends_at, device_id, config)
  values (p_id, auth.uid(), p_task_id, p_kind, p_started_at,
          case when p_kind <> 'stopwatch' then p_started_at + make_interval(secs => p_seconds) end,
          p_device, coalesce(p_config, '{}'))
  returning * into v_timer;
  return v_timer;
end;
$$;

-- Mexe num timer meu: 'adjust' (+/− segundos no fim, nunca antes de agora), 'pause', 'resume',
-- 'done', 'skip' e 'cancel'. Timer que já terminou não muda (devolve como está).
create function public.update_timer(p_id uuid, p_action text, p_seconds integer default 0, p_at timestamptz default now())
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
      -- Cronômetro parado: o fim é quando parou (o tempo medido fica em ends_at − started_at)
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
  return v_timer;
end;
$$;

revoke execute on function public.start_timer(uuid, text, timestamptz, integer, uuid, jsonb, text) from public, anon;
revoke execute on function public.update_timer(uuid, text, integer, timestamptz) from public, anon;
grant execute on function public.start_timer(uuid, text, timestamptz, integer, uuid, jsonb, text) to authenticated;
grant execute on function public.update_timer(uuid, text, integer, timestamptz) to authenticated;

-- Terminados há mais de 30 dias saem (o que conta tempo fica em time_entries, na K)
select cron.schedule('timers-retencao', '17 4 * * *',
  $$delete from public.timers where state not in ('running', 'paused') and coalesce(ended_at, started_at) < now() - interval '30 days'$$);

-- Timers também pela fila do aparelho (offline)
create or replace function public.run_once(p_key uuid, p_name text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;
