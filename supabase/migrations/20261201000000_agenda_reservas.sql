-- AG2 (D311, ESCOPO_V12 §1): tipos de compromisso e a página pública de reservas. Quem tem o link
-- (/agenda/<apelido>/<tipo>) vê os horários livres e reserva sem conta; a reserva vira uma tarefa
-- na lista "Reservas" da pasta "Agenda" da pessoa e um aviso. Quem reservou remarca ou cancela pelo
-- link da reserva (/reserva/<token>). A conta dos horários é toda daqui: a página pública recebe só
-- horários livres, nunca o que ocupa a agenda.

-- Avisos novos da agenda (texto em supabase/functions/_shared/notification-text.ts)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder',
  'challenge_finished', 'note_shared', 'booking', 'booking_cancelled', 'booking_rescheduled'));

-- Tipos de compromisso: só a dona vê e muda (a página pública lê pelas RPCs abaixo)
create table public.booking_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  duration_min smallint not null default 30 check (duration_min between 5 and 480),
  buffer_before smallint not null default 0 check (buffer_before between 0 and 240),
  buffer_after smallint not null default 0 check (buffer_after between 0 and 240),
  -- Antecedência mínima (minutos) e até quantos dias à frente
  min_notice_min integer not null default 240 check (min_notice_min between 0 and 43200),
  max_days smallint not null default 30 check (max_days between 1 and 365),
  daily_limit smallint check (daily_limit between 1 and 50),
  -- Perguntas a quem reserva (nome e e-mail sempre)
  ask_phone text not null default 'off' check (ask_phone in ('off', 'optional', 'required')),
  ask_note text not null default 'optional' check (ask_note in ('off', 'optional', 'required')),
  -- V12-3: confirma sozinha, a não ser que o tipo peça aprovação
  needs_approval boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.booking_types enable row level security;
revoke all on public.booking_types from anon;
revoke insert, update on public.booking_types from authenticated;
grant insert (id, slug, name, description, duration_min, buffer_before, buffer_after, min_notice_min,
              max_days, daily_limit, ask_phone, ask_note, needs_approval, active),
  update (slug, name, description, duration_min, buffer_before, buffer_after, min_notice_min,
          max_days, daily_limit, ask_phone, ask_note, needs_approval, active)
  on public.booking_types to authenticated;
create policy "booking_types_select" on public.booking_types for select to authenticated
  using (user_id = (select auth.uid()));
create policy "booking_types_insert" on public.booking_types for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "booking_types_update" on public.booking_types for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "booking_types_delete" on public.booking_types for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.booking_types_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.booking_types where user_id = new.user_id) >= 20 then
    raise exception 'Tipos de compromisso demais' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger booking_types_write before insert or update on public.booking_types
  for each row execute function public.booking_types_write();

-- Reservas: dado de quem não tem conta (nome, e-mail, telefone). A dona lê; ninguém grava direto.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type_id uuid references public.booking_types (id) on delete set null,
  type_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_name text not null check (char_length(btrim(guest_name)) between 1 and 80),
  guest_email text not null check (char_length(guest_email) <= 254 and guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  guest_phone text check (char_length(guest_phone) <= 40),
  guest_note text check (char_length(guest_note) <= 1000),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled', 'declined')),
  cancelled_by text check (cancelled_by in ('guest', 'owner')),
  -- O link de remarcar e cancelar de quem reservou
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_owner_starts on public.bookings (owner_id, starts_at);
create index bookings_task on public.bookings (task_id) where task_id is not null;

alter table public.bookings enable row level security;
revoke all on public.bookings from anon;
revoke insert, update on public.bookings from authenticated;
create policy "bookings_select" on public.bookings for select to authenticated
  using (owner_id = (select auth.uid()));

-- Onde as reservas viram tarefas: a lista "Reservas" da pasta "Agenda", criada na primeira vez.
-- Se a pessoa apagar ou mover, a próxima reserva cria de novo.
create table public.agenda_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null
);
alter table public.agenda_settings enable row level security;
revoke all on public.agenda_settings from anon, authenticated;
grant select on public.agenda_settings to authenticated;
create policy "agenda_settings_select" on public.agenda_settings for select to authenticated
  using (user_id = (select auth.uid()));

create function public._agenda_page(p_owner uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page uuid;
  v_folder uuid;
  v_locale text;
begin
  select s.page_id into v_page from public.agenda_settings s
  join public.pages p on p.id = s.page_id
  join public.folders f on f.id = p.folder_id
  where s.user_id = p_owner and f.owner_id = p_owner and p.view_type = 'list';
  if v_page is not null then
    return v_page;
  end if;
  select locale into v_locale from public.profiles where id = p_owner;
  insert into public.folders (owner_id, name, icon)
  values (p_owner, 'Agenda', 'lucide:calendar-clock')
  returning id into v_folder;
  insert into public.pages (folder_id, name, icon)
  values (v_folder, case when v_locale = 'en' then 'Bookings' else 'Reservas' end, 'lucide:calendar-check')
  returning id into v_page;
  insert into public.agenda_settings (user_id, page_id) values (p_owner, v_page)
  on conflict (user_id) do update set page_id = excluded.page_id;
  return v_page;
end;
$$;

-- Ocupado entre p_from e p_to: reservas (pendentes e confirmadas), tarefas com horário da pessoa
-- (as dela sem responsável e as em que ela é responsável; duração = estimativa ou 30 min, V12-4) e
-- os trechos das exceções. A reserva p_ignore (remarcando) e a tarefa dela não contam.
create function public._agenda_busy(p_owner uuid, p_from timestamptz, p_to timestamptz, p_ignore uuid)
returns tstzrange[]
language sql stable security definer set search_path = ''
as $$
  with tz as (
    select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') as tz from public.profiles where id = p_owner
  ),
  ignored as (select task_id from public.bookings where id = p_ignore)
  select coalesce(array_agg(r), '{}') from (
    select tstzrange(b.starts_at, b.ends_at) as r
    from public.bookings b
    where b.owner_id = p_owner and b.status in ('pending', 'confirmed') and b.id is distinct from p_ignore
      and b.starts_at < p_to and b.ends_at > p_from
    union all
    select tstzrange(s, s + make_interval(mins => coalesce(nullif(t.estimate_minutes, 0), 30)))
    from public.tasks t
    cross join tz
    cross join lateral (select (t.due_date + t.due_time) at time zone tz.tz as s) x
    where t.due_time is not null and t.status <> 'done'
      and t.due_date between (p_from at time zone tz.tz)::date - 1 and (p_to at time zone tz.tz)::date + 1
      and t.id is distinct from (select task_id from ignored)
      and (
        exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = p_owner)
        or (not exists (select 1 from public.task_assignees a where a.task_id = t.id)
            and exists (select 1 from public.folders f where f.id = public.folder_root(t.folder_id)
                        and f.owner_id = p_owner))
      )
      and s < p_to and s + make_interval(mins => coalesce(nullif(t.estimate_minutes, 0), 30)) > p_from
    union all
    select tstzrange((d + e.starts) at time zone tz.tz, (d + e.ends) at time zone tz.tz)
    from public.availability_exceptions e
    cross join tz
    cross join lateral generate_series(e.starts_on, e.ends_on, interval '1 day') g(d0)
    cross join lateral (select g.d0::date as d) dd
    where e.user_id = p_owner and e.starts is not null
      and e.ends_on >= (p_from at time zone tz.tz)::date - 1 and e.starts_on <= (p_to at time zone tz.tz)::date + 1
  ) busy;
$$;

-- Horários livres de um tipo, dos dias p_from a p_to (no fuso da dona). Um começo a cada
-- `duration_min` dentro de cada trecho da semana; fica de fora o que cai numa exceção de dia
-- inteiro, encosta no ocupado (com os intervalos antes e depois), fura a antecedência mínima ou
-- passa dos dias à frente, e o dia que já bateu o limite.
create function public._booking_free_slots(p_type public.booking_types, p_from date, p_to date, p_ignore uuid)
returns setof timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text;
  v_busy tstzrange[];
  v_day date;
  v_rule record;
  v_m integer;
  v_start timestamptz;
  v_earliest timestamptz := now() + make_interval(mins => p_type.min_notice_min);
  v_latest timestamptz := now() + make_interval(days => p_type.max_days);
  v_dur interval := make_interval(mins => p_type.duration_min);
  v_before interval := make_interval(mins => p_type.buffer_before);
  v_after interval := make_interval(mins => p_type.buffer_after);
begin
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = p_type.user_id;
  if p_to < p_from or p_to - p_from > 62 then
    return;
  end if;
  v_busy := public._agenda_busy(p_type.user_id, (p_from::timestamp at time zone v_tz) - interval '1 day',
                                (p_to::timestamp at time zone v_tz) + interval '2 days', p_ignore);
  for v_day in select g::date from generate_series(p_from, p_to, interval '1 day') g loop
    if exists (select 1 from public.availability_exceptions e
               where e.user_id = p_type.user_id and e.starts is null and v_day between e.starts_on and e.ends_on) then
      continue;
    end if;
    if p_type.daily_limit is not null and (
      select count(*) from public.bookings b
      where b.owner_id = p_type.user_id and b.status in ('pending', 'confirmed') and b.id is distinct from p_ignore
        and (b.starts_at at time zone v_tz)::date = v_day) >= p_type.daily_limit then
      continue;
    end if;
    for v_rule in
      select (extract(epoch from r.starts) / 60)::integer as a, (extract(epoch from r.ends) / 60)::integer as b
      from public.availability_rules r
      where r.user_id = p_type.user_id and r.weekday = extract(isodow from v_day)
      order by r.starts
    loop
      v_m := v_rule.a;
      while v_m + p_type.duration_min <= v_rule.b loop
        v_start := (v_day + make_interval(mins => v_m)) at time zone v_tz;
        if v_start >= v_earliest and v_start <= v_latest
           and not exists (select 1 from unnest(v_busy) x
                           where x && tstzrange(v_start - v_before, v_start + v_dur + v_after)) then
          return next v_start;
        end if;
        v_m := v_m + p_type.duration_min;
      end loop;
    end loop;
  end loop;
end;
$$;

create function public._booking_type(p_handle text, p_slug text)
returns public.booking_types
language sql stable security definer set search_path = ''
as $$
  select t.* from public.booking_types t join public.profiles p on p.id = t.user_id
  where lower(p.username) = lower(btrim(p_handle)) and t.slug = lower(btrim(p_slug)) and t.active
$$;

-- Página pública de uma pessoa: o nome e os tipos ativos (sem nada da agenda)
create function public.booking_profile(p_handle text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when p.id is null then jsonb_build_object('status', 'missing') else jsonb_build_object(
    'status', 'ok',
    'name', p.display_name,
    'username', p.username,
    'timezone', p.timezone,
    'types', coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name,
                                                           'description', t.description,
                                                           'duration_min', t.duration_min) order by t.created_at)
                       from public.booking_types t where t.user_id = p.id and t.active), '[]'))
  end
  from (select 1) one
  left join public.profiles p on lower(p.username) = lower(btrim(p_handle))
$$;

-- Os horários livres de um tipo (até 62 dias de uma vez). Com p_token (remarcando), a própria
-- reserva não ocupa o horário.
create function public.booking_slots(p_handle text, p_slug text, p_from date, p_to date, p_token text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_type public.booking_types;
  v_profile public.profiles;
  v_ignore uuid;
begin
  v_type := public._booking_type(p_handle, p_slug);
  if v_type.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  select * into v_profile from public.profiles where id = v_type.user_id;
  if p_token is not null then
    select id into v_ignore from public.bookings where token = p_token and type_id = v_type.id;
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'owner', v_profile.display_name,
    'username', v_profile.username,
    'timezone', v_profile.timezone,
    'type', jsonb_build_object('slug', v_type.slug, 'name', v_type.name, 'description', v_type.description,
                               'duration_min', v_type.duration_min, 'ask_phone', v_type.ask_phone,
                               'ask_note', v_type.ask_note, 'needs_approval', v_type.needs_approval,
                               'max_days', v_type.max_days),
    'slots', coalesce((select jsonb_agg(s order by s)
                       from public._booking_free_slots(v_type, p_from, p_to, v_ignore) s), '[]'));
end;
$$;

-- A reserva vira tarefa na lista Reservas (data, horário, duração e as respostas na descrição)
create function public._booking_task(p_booking public.bookings)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page uuid := public._agenda_page(p_booking.owner_id);
  v_tz text;
  v_local timestamp;
  v_id uuid;
begin
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = p_booking.owner_id;
  v_local := p_booking.starts_at at time zone v_tz;
  insert into public.tasks (page_id, title, notes, due_date, due_time, estimate_minutes, remind_before,
                            created_by, position)
  values (
    v_page,
    left(p_booking.type_name || ': ' || p_booking.guest_name, 200),
    concat_ws(e'\n',
      p_booking.guest_email,
      p_booking.guest_phone,
      case when p_booking.guest_note is not null then e'\n' || p_booking.guest_note end),
    v_local::date,
    v_local::time,
    extract(epoch from p_booking.ends_at - p_booking.starts_at)::integer / 60,
    15,
    p_booking.owner_id,
    coalesce((select max(position) from public.tasks where page_id = v_page), 0) + 1
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Reservar (sem conta). Confere de novo que o horário está livre com a agenda da dona travada
-- (dois reservando o mesmo horário: o segundo recebe 'taken'). Limites contra abuso: 3 reservas
-- futuras por e-mail com a mesma pessoa e 30 reservas novas por dia para cada pessoa (o limite por
-- IP fica no serve.mjs).
create function public.book_slot(p_handle text, p_slug text, p_starts timestamptz, p_name text, p_email text,
                                 p_phone text default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_type public.booking_types;
  v_tz text;
  v_booking public.bookings;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_day date;
begin
  v_type := public._booking_type(p_handle, p_slug);
  if v_type.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254
     or (v_type.ask_phone = 'required' and v_phone is null)
     or (v_type.ask_note = 'required' and v_note is null)
     or char_length(coalesce(v_phone, '')) > 40 or char_length(coalesce(v_note, '')) > 1000 then
    return jsonb_build_object('status', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_type.user_id::text, 0));
  if (select count(*) from public.bookings where owner_id = v_type.user_id and lower(guest_email) = v_email
      and status in ('pending', 'confirmed') and ends_at > now()) >= 3
     or (select count(*) from public.bookings where owner_id = v_type.user_id
         and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('status', 'limit');
  end if;
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = v_type.user_id;
  v_day := (p_starts at time zone v_tz)::date;
  if not exists (select 1 from public._booking_free_slots(v_type, v_day, v_day, null) s where s = p_starts) then
    return jsonb_build_object('status', 'taken');
  end if;
  insert into public.bookings (owner_id, type_id, type_name, starts_at, ends_at, guest_name, guest_email,
                               guest_phone, guest_note, status)
  values (v_type.user_id, v_type.id, v_type.name, p_starts, p_starts + make_interval(mins => v_type.duration_min),
          btrim(p_name), v_email, case when v_type.ask_phone <> 'off' then v_phone end,
          case when v_type.ask_note <> 'off' then v_note end,
          case when v_type.needs_approval then 'pending' else 'confirmed' end)
  returning * into v_booking;
  if v_booking.status = 'confirmed' then
    update public.bookings set task_id = public._booking_task(v_booking) where id = v_booking.id
    returning * into v_booking;
  end if;
  perform public._notify(v_booking.owner_id, 'booking', jsonb_build_object(
    'guest', v_booking.guest_name, 'type_name', v_booking.type_name, 'status', v_booking.status,
    'starts_at', v_booking.starts_at, 'task_id', v_booking.task_id, 'timezone', v_tz));
  return jsonb_build_object('status', 'ok', 'token', v_booking.token, 'booking', public._booking_public(v_booking));
end;
$$;

-- O que quem reservou vê da própria reserva
create function public._booking_public(p_booking public.bookings)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'type_name', p_booking.type_name,
    'type_slug', t.slug,
    'starts_at', p_booking.starts_at,
    'ends_at', p_booking.ends_at,
    'status', p_booking.status,
    'cancelled_by', p_booking.cancelled_by,
    'guest_name', p_booking.guest_name,
    'owner', p.display_name,
    'username', p.username,
    'timezone', p.timezone,
    'can_change', p_booking.status in ('pending', 'confirmed') and p_booking.starts_at > now() and t.active is true)
  from public.profiles p
  left join public.booking_types t on t.id = p_booking.type_id
  where p.id = p_booking.owner_id
$$;

create function public.booking_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where token = p_token;
  if v_booking.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object('status', 'ok', 'booking', public._booking_public(v_booking));
end;
$$;

-- Quem reservou cancela: a tarefa vai para a lixeira da dona e ela recebe o aviso
create function public.cancel_booking(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where token = p_token for update;
  if v_booking.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_booking.status not in ('pending', 'confirmed') or v_booking.starts_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  update public.bookings set status = 'cancelled', cancelled_by = 'guest', task_id = null, updated_at = now()
  where id = v_booking.id;
  delete from public.tasks where id = v_booking.task_id;
  perform public._notify(v_booking.owner_id, 'booking_cancelled', jsonb_build_object(
    'guest', v_booking.guest_name, 'type_name', v_booking.type_name, 'starts_at', v_booking.starts_at,
    'timezone', (select timezone from public.profiles where id = v_booking.owner_id)));
  select * into v_booking from public.bookings where id = v_booking.id;
  return jsonb_build_object('status', 'ok', 'booking', public._booking_public(v_booking));
end;
$$;

-- Quem reservou remarca para outro horário livre do mesmo tipo (a tarefa muda junto)
create function public.reschedule_booking(p_token text, p_starts timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_type public.booking_types;
  v_tz text;
  v_day date;
  v_local timestamp;
  v_old timestamptz;
begin
  select * into v_booking from public.bookings where token = p_token;
  if v_booking.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  select * into v_type from public.booking_types where id = v_booking.type_id and active;
  if v_type.id is null or v_booking.status not in ('pending', 'confirmed') or v_booking.starts_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_type.user_id::text, 0));
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = v_type.user_id;
  v_day := (p_starts at time zone v_tz)::date;
  if not exists (select 1 from public._booking_free_slots(v_type, v_day, v_day, v_booking.id) s where s = p_starts) then
    return jsonb_build_object('status', 'taken');
  end if;
  v_old := v_booking.starts_at;
  update public.bookings
  set starts_at = p_starts, ends_at = p_starts + make_interval(mins => v_type.duration_min), updated_at = now()
  where id = v_booking.id
  returning * into v_booking;
  v_local := p_starts at time zone v_tz;
  update public.tasks set due_date = v_local::date, due_time = v_local::time,
                          estimate_minutes = v_type.duration_min, reminded_at = null
  where id = v_booking.task_id;
  perform public._notify(v_booking.owner_id, 'booking_rescheduled', jsonb_build_object(
    'guest', v_booking.guest_name, 'type_name', v_booking.type_name, 'starts_at', v_booking.starts_at,
    'old_starts_at', v_old, 'task_id', v_booking.task_id, 'timezone', v_tz));
  return jsonb_build_object('status', 'ok', 'booking', public._booking_public(v_booking));
end;
$$;

-- A dona aprova, recusa ou cancela (quem reservou vê o novo estado pelo link)
create function public.respond_booking(p_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_id and owner_id = auth.uid() for update;
  if v_booking.id is null then
    raise exception 'Reserva não encontrada' using errcode = 'P0002';
  end if;
  if p_action = 'approve' and v_booking.status = 'pending' then
    update public.bookings set status = 'confirmed', updated_at = now(), task_id = public._booking_task(v_booking)
    where id = p_id;
  elsif p_action = 'decline' and v_booking.status = 'pending' then
    update public.bookings set status = 'declined', updated_at = now() where id = p_id;
  elsif p_action = 'cancel' and v_booking.status in ('pending', 'confirmed') then
    update public.bookings set status = 'cancelled', cancelled_by = 'owner', task_id = null, updated_at = now()
    where id = p_id;
    delete from public.tasks where id = v_booking.task_id;
  else
    raise exception 'Esta reserva não pode mudar assim' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public._agenda_page(uuid), public._agenda_busy(uuid, timestamptz, timestamptz, uuid),
  public._booking_free_slots(public.booking_types, date, date, uuid), public._booking_type(text, text),
  public._booking_task(public.bookings), public._booking_public(public.bookings) from public, anon, authenticated;
revoke execute on function public.booking_profile(text), public.booking_slots(text, text, date, date, text),
  public.book_slot(text, text, timestamptz, text, text, text, text), public.booking_by_token(text),
  public.cancel_booking(text), public.reschedule_booking(text, timestamptz), public.respond_booking(uuid, text)
  from public;
grant execute on function public.booking_profile(text), public.booking_slots(text, text, date, date, text),
  public.book_slot(text, text, timestamptz, text, text, text, text), public.booking_by_token(text),
  public.cancel_booking(text), public.reschedule_booking(text, timestamptz) to anon, authenticated;
grant execute on function public.respond_booking(uuid, text) to authenticated;

-- Retenção (padrão do escopo): a reserva some 1 ano depois do compromisso; a tarefa fica
select cron.schedule('agenda-reservas-retencao', '29 4 * * *',
  $$delete from public.bookings where ends_at < now() - interval '1 year'$$);

-- A política muda (dado de quem reserva, sem conta): todo mundo aceita de novo (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-21' $$;

-- Exportação com a agenda
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
    -- V6: peso e medidas (dado sensível, AC7) e o consentimento dado para eles
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id' order by b.kind, b.measured_on)
                              from public.body_metrics b where b.user_id = v_user), '[]'),
    'body_goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.body_goals g
                            where g.user_id = v_user), '[]'),
    -- Bem-estar: remédios (dado de saúde, sensível, BE4)
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.created_at)
                             from public.medications m where m.user_id = v_user), '[]'),
    'sensitive_consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.granted_at)
                                    from public.sensitive_consents c where c.user_id = v_user), '[]'),
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
  ) || jsonb_build_object(
    -- V11 (OB11): anotações da pessoa e as versões delas
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notes n
                       where n.user_id = v_user), '[]'),
    'note_versions', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id' order by v.created_at) from public.note_versions v
                               where v.user_id = v_user), '[]'),
    -- OB14: com quem compartilhei (e o que recebi) e o que publiquei (sem o hash da senha)
    'note_shares', coalesce((select jsonb_agg(jsonb_build_object('note_id', s.note_id, 'role', s.role,
                                                                  'mine', s.owner_id = v_user, 'at', s.created_at)
                                              order by s.created_at)
                             from public.note_shares s where s.owner_id = v_user or s.user_id = v_user), '[]'),
    'note_publications', coalesce((select jsonb_agg(to_jsonb(p) - 'owner_id' - 'password_hash' order by p.created_at)
                                   from public.note_publications p where p.owner_id = v_user), '[]'),
    -- V12 (AG1): a disponibilidade da agenda
    'availability_rules', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.weekday, r.starts)
                                    from public.availability_rules r where r.user_id = v_user), '[]'),
    'availability_exceptions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.starts_on)
                                         from public.availability_exceptions x where x.user_id = v_user), '[]'),
    -- AG2: tipos de compromisso e as reservas feitas comigo (com os dados de quem reservou)
    'booking_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at)
                               from public.booking_types t where t.user_id = v_user), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'owner_id' - 'token' order by b.starts_at)
                          from public.bookings b where b.owner_id = v_user), '[]')
  );
end;
$function$;
