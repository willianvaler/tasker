-- Enquete de horário (AG4, ESCOPO_V12 §2, D319): a dona propõe de 2 a 5 horários, manda o link,
-- cada pessoa (com ou sem conta) marca os que servem e a dona fecha num deles, que vira tarefa com
-- horário na lista da agenda (a mesma das reservas, `_agenda_page`). Tudo grava por RPC: a dona lê
-- as três tabelas pela RLS; quem abre o link lê e vota pelas RPCs anônimas (limitadas no serve.mjs).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder',
  'challenge_finished', 'note_shared', 'booking', 'booking_cancelled', 'booking_rescheduled', 'poll_vote'));

create table public.time_polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  duration_min integer not null default 30 check (duration_min between 5 and 480),
  note text check (char_length(note) <= 1000),
  -- O link que a dona manda
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  status text not null default 'open' check (status in ('open', 'closed')),
  chosen_slot uuid,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index time_polls_owner on public.time_polls (owner_id, created_at desc);

create table public.time_poll_slots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.time_polls (id) on delete cascade,
  starts_at timestamptz not null,
  unique (poll_id, starts_at)
);
alter table public.time_polls add constraint time_polls_chosen_slot_fkey
  foreign key (chosen_slot) references public.time_poll_slots (id) on delete set null;

create table public.time_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.time_polls (id) on delete cascade,
  -- Quem votou, guardado no navegador dela para poder mudar o voto (não é segredo de ninguém)
  voter text not null check (char_length(voter) between 16 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  slots uuid[] not null default '{}' check (cardinality(slots) <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, voter)
);

alter table public.time_polls enable row level security;
alter table public.time_poll_slots enable row level security;
alter table public.time_poll_votes enable row level security;
revoke all on public.time_polls, public.time_poll_slots, public.time_poll_votes from anon;
revoke insert, update, delete on public.time_polls, public.time_poll_slots, public.time_poll_votes
  from authenticated;
create policy "time_polls_select" on public.time_polls for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "time_poll_slots_select" on public.time_poll_slots for select to authenticated
  using (exists (select 1 from public.time_polls p where p.id = poll_id and p.owner_id = (select auth.uid())));
create policy "time_poll_votes_select" on public.time_poll_votes for select to authenticated
  using (exists (select 1 from public.time_polls p where p.id = poll_id and p.owner_id = (select auth.uid())));
-- Apagar a enquete (os horários e votos vão junto)
grant delete on public.time_polls to authenticated;
create policy "time_polls_delete" on public.time_polls for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Criar (p_id novo) ou mudar uma enquete aberta. Os horários trocam inteiros: o que continua mantém
-- os votos; o que saiu sai também dos votos. No máximo 20 enquetes abertas por pessoa.
create function public.save_time_poll(p_id uuid, p_title text, p_duration integer, p_note text,
                                      p_slots timestamptz[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_poll public.time_polls;
  v_slots timestamptz[];
begin
  if v_user is null then
    raise exception 'Entre para criar uma enquete' using errcode = '42501';
  end if;
  select array_agg(distinct date_trunc('minute', s) order by date_trunc('minute', s)) into v_slots
  from unnest(p_slots) s where s is not null;
  if coalesce(cardinality(v_slots), 0) not between 2 and 5 then
    raise exception 'Proponha de 2 a 5 horários' using errcode = '22023';
  end if;
  select * into v_poll from public.time_polls where id = p_id for update;
  if v_poll.id is not null and (v_poll.owner_id <> v_user) then
    raise exception 'Enquete não encontrada' using errcode = 'P0002';
  end if;
  if v_poll.id is not null and v_poll.status <> 'open' then
    raise exception 'A enquete já foi fechada' using errcode = '22023';
  end if;
  if v_poll.id is null then
    if (select count(*) from public.time_polls where owner_id = v_user and status = 'open') >= 20 then
      raise exception 'No máximo 20 enquetes abertas' using errcode = '22023';
    end if;
    insert into public.time_polls (id, owner_id, title, duration_min, note)
    values (coalesce(p_id, gen_random_uuid()), v_user, btrim(p_title), p_duration,
            nullif(btrim(coalesce(p_note, '')), ''))
    returning * into v_poll;
  else
    update public.time_polls set title = btrim(p_title), duration_min = p_duration,
                                 note = nullif(btrim(coalesce(p_note, '')), '')
    where id = v_poll.id;
  end if;
  delete from public.time_poll_slots where poll_id = v_poll.id and starts_at <> all (v_slots);
  insert into public.time_poll_slots (poll_id, starts_at)
  select v_poll.id, s from unnest(v_slots) s
  on conflict (poll_id, starts_at) do nothing;
  update public.time_poll_votes v
  set slots = array(select x from unnest(v.slots) x
                    where x in (select id from public.time_poll_slots where poll_id = v_poll.id))
  where v.poll_id = v_poll.id;
  return v_poll.id;
end;
$$;

-- A dona fecha num horário: vira tarefa com horário na lista da agenda (quem marcou vai nas notas)
create function public.close_time_poll(p_id uuid, p_slot uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.time_polls;
  v_starts timestamptz;
  v_tz text;
  v_local timestamp;
  v_page uuid;
  v_task uuid;
begin
  select * into v_poll from public.time_polls where id = p_id and owner_id = auth.uid() for update;
  if v_poll.id is null then
    raise exception 'Enquete não encontrada' using errcode = 'P0002';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'A enquete já foi fechada' using errcode = '22023';
  end if;
  select starts_at into v_starts from public.time_poll_slots where id = p_slot and poll_id = p_id;
  if v_starts is null then
    raise exception 'Horário não é desta enquete' using errcode = '22023';
  end if;
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = v_poll.owner_id;
  v_local := v_starts at time zone v_tz;
  v_page := public._agenda_page(v_poll.owner_id);
  insert into public.tasks (page_id, title, notes, due_date, due_time, estimate_minutes, remind_before,
                            created_by, position)
  values (
    v_page, left(v_poll.title, 200),
    nullif(concat_ws(e'\n',
      v_poll.note,
      (select string_agg(v.name || coalesce(' <' || v.email || '>', ''), e'\n' order by v.created_at)
       from public.time_poll_votes v where v.poll_id = p_id and p_slot = any (v.slots))), ''),
    v_local::date, v_local::time, v_poll.duration_min, 15, v_poll.owner_id,
    coalesce((select max(position) from public.tasks where page_id = v_page), 0) + 1)
  returning id into v_task;
  update public.time_polls set status = 'closed', chosen_slot = p_slot, closed_at = now(), task_id = v_task
  where id = p_id;
  return v_task;
end;
$$;

-- O que quem abre o link vê: título, de quem, os horários com quantos e quem marcou (nomes, nunca o
-- e-mail) e, com o próprio `voter`, o voto dela para mudar
create function public.time_poll_public(p_token text, p_voter text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_poll public.time_polls;
begin
  select * into v_poll from public.time_polls where token = p_token;
  if v_poll.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object('status', 'ok', 'poll', jsonb_build_object(
    'title', v_poll.title,
    'note', v_poll.note,
    'duration_min', v_poll.duration_min,
    'state', v_poll.status,
    'owner', (select display_name from public.profiles where id = v_poll.owner_id),
    'timezone', (select timezone from public.profiles where id = v_poll.owner_id),
    'chosen', (select starts_at from public.time_poll_slots where id = v_poll.chosen_slot),
    'voters', (select count(*) from public.time_poll_votes where poll_id = v_poll.id),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'starts_at', s.starts_at,
        'names', coalesce((select jsonb_agg(v.name order by v.created_at) from public.time_poll_votes v
                           where v.poll_id = v_poll.id and s.id = any (v.slots)), '[]'))
        order by s.starts_at)
      from public.time_poll_slots s where s.poll_id = v_poll.id), '[]'),
    'mine', (select jsonb_build_object('name', v.name, 'email', v.email, 'slots', to_jsonb(v.slots))
             from public.time_poll_votes v where v.poll_id = v_poll.id and v.voter = p_voter)));
end;
$$;

-- Votar (sem conta) ou mudar o voto. No máximo 50 pessoas por enquete; a dona recebe um aviso na
-- primeira vez de cada pessoa.
create function public.time_poll_vote(p_token text, p_voter text, p_name text, p_email text, p_slots uuid[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.time_polls;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_slots uuid[];
  v_new boolean;
begin
  select * into v_poll from public.time_polls where token = p_token;
  if v_poll.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_poll.status <> 'open' then
    return jsonb_build_object('status', 'closed');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80
     or char_length(coalesce(p_voter, '')) not between 16 and 64
     or (v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254)) then
    return jsonb_build_object('status', 'invalid');
  end if;
  select coalesce(array_agg(id), '{}') into v_slots from public.time_poll_slots
  where poll_id = v_poll.id and id = any (coalesce(p_slots, '{}'));
  perform pg_advisory_xact_lock(hashtextextended('poll:' || v_poll.id::text, 0));
  v_new := not exists (select 1 from public.time_poll_votes where poll_id = v_poll.id and voter = p_voter);
  if v_new and (select count(*) from public.time_poll_votes where poll_id = v_poll.id) >= 50 then
    return jsonb_build_object('status', 'limit');
  end if;
  insert into public.time_poll_votes (poll_id, voter, name, email, slots)
  values (v_poll.id, p_voter, btrim(p_name), v_email, v_slots)
  on conflict (poll_id, voter) do update
    set name = excluded.name, email = excluded.email, slots = excluded.slots, updated_at = now();
  if v_new then
    perform public._notify(v_poll.owner_id, 'poll_vote', jsonb_build_object(
      'guest', btrim(p_name), 'title', v_poll.title, 'poll_id', v_poll.id));
  end if;
  return public.time_poll_public(p_token, p_voter);
end;
$$;

revoke execute on function public.save_time_poll(uuid, text, integer, text, timestamptz[]),
  public.close_time_poll(uuid, uuid), public.time_poll_public(text, text),
  public.time_poll_vote(text, text, text, text, uuid[]) from public;
grant execute on function public.save_time_poll(uuid, text, integer, text, timestamptz[]),
  public.close_time_poll(uuid, uuid) to authenticated;
grant execute on function public.time_poll_public(text, text),
  public.time_poll_vote(text, text, text, text, uuid[]) to anon, authenticated;

-- Retenção (como as reservas): a enquete some 1 ano depois de fechada (ou de criada, se nunca fechou)
select cron.schedule('agenda-enquetes-retencao', '34 4 * * *',
  $$delete from public.time_polls where coalesce(closed_at, created_at) < now() - interval '1 year'$$);

-- A política muda (nome e e-mail de quem responde a enquete, sem conta): todo mundo aceita de novo
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-21.2' $$;

-- Exportação com as enquetes
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
                          from public.bookings b where b.owner_id = v_user), '[]'),
    'time_polls', coalesce((select jsonb_agg(to_jsonb(tp) - 'owner_id' - 'token' || jsonb_build_object(
        'slots', coalesce((select jsonb_agg(s.starts_at order by s.starts_at)
                           from public.time_poll_slots s where s.poll_id = tp.id), '[]'),
        'votes', coalesce((select jsonb_agg(jsonb_build_object('name', v.name, 'email', v.email,
                             'slots', (select coalesce(jsonb_agg(s.starts_at order by s.starts_at), '[]')
                                       from public.time_poll_slots s where s.id = any (v.slots)))
                           order by v.created_at)
                           from public.time_poll_votes v where v.poll_id = tp.id), '[]'))
        order by tp.created_at)
                            from public.time_polls tp where tp.owner_id = v_user), '[]')
  );
end;
$function$;
