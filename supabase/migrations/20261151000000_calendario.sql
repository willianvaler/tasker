-- C1 (ESCOPO §11 + V3 §6 item B): calendário. O app mostra as tarefas com data numa tela própria;
-- fora do app, um feed .ics com link secreto (por pessoa) que o Google Agenda, o Apple Calendário
-- e o Outlook assinam por URL. O feed é servido pelo scripts/serve.mjs em /calendario/<token>.ics,
-- que chama calendar_ics com a chave publicável: o token é a única credencial.
--
-- Entra no feed: tarefa de primeiro nível com data, de qualquer pasta ou projeto da pessoa, fora
-- das páginas de hábitos. Concluída sai (a recorrente segue, com a próxima data). Página de treino
-- (de cards ou da Academia, como em _is_workout_page) vira um evento só por dia, com o nome da
-- página e o link para ela; os exercícios vão na descrição. Recorrência vira RRULE: quem expande
-- as datas é o app de calendário.

create table public.calendar_feeds (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
create policy calendar_feeds_select on public.calendar_feeds
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.calendar_feeds from anon, authenticated;
grant select on public.calendar_feeds to authenticated;

-- O link da pessoa (cria na primeira vez). p_rotate: troca o token (o link antigo para de valer).
create function public.calendar_feed_link(p_rotate boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'Entre na sua conta' using errcode = '42501';
  end if;
  if p_rotate then
    delete from public.calendar_feeds where user_id = v_user;
  end if;
  insert into public.calendar_feeds (user_id) values (v_user) on conflict (user_id) do nothing;
  select token into v_token from public.calendar_feeds where user_id = v_user;
  return v_token;
end;
$$;

-- Desliga o feed: o link deixa de existir
create function public.calendar_feed_off()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.calendar_feeds where user_id = (select auth.uid());
$$;

-- Texto de propriedade do iCalendar (RFC 5545 §3.3.11)
create function public._ics_text(p_text text)
returns text
language sql immutable set search_path = ''
as $$
  select replace(replace(replace(replace(replace(coalesce(p_text, ''),
    '\', '\\'), ';', '\;'), ',', '\,'), E'\r', ''), E'\n', '\n');
$$;

-- Dobra a linha em pedaços de até 75 bytes (RFC 5545 §3.1), sem partir um caractere UTF-8
create function public._ics_fold(p_line text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_out text := '';
  v_part text := '';
  v_limit integer := 75;
  v_char text;
begin
  if octet_length(p_line) <= 75 then
    return p_line;
  end if;
  foreach v_char in array regexp_split_to_array(p_line, '') loop
    if octet_length(v_part) + octet_length(v_char) > v_limit then
      v_out := v_out || v_part || E'\r\n ';
      v_part := '';
      v_limit := 74; -- a continuação começa com um espaço
    end if;
    v_part := v_part || v_char;
  end loop;
  return v_out || v_part;
end;
$$;

-- Recorrência do app (D18) → RRULE. Mesmas datas de public.next_due_date / lib/calendar.ts:
-- semanal e mensal contam da data original; mensal num dia que o mês não tem cai no último dia.
create function public._ics_rrule(p_recurrence jsonb, p_due date)
returns text
language sql immutable set search_path = ''
as $$
  select case p_recurrence ->> 'type'
    when 'daily' then 'FREQ=DAILY'
    when 'weekly' then 'FREQ=WEEKLY'
    when 'monthly' then
      case when extract(day from p_due) > 28
        then 'FREQ=MONTHLY;BYMONTHDAY='
          || (select string_agg(d::text, ',' order by d) from generate_series(28, extract(day from p_due)::int) d)
          || ';BYSETPOS=-1'
        else 'FREQ=MONTHLY' end
    when 'weekdays' then
      nullif('FREQ=WEEKLY;BYDAY=' || coalesce((
        select string_agg((array['SU','MO','TU','WE','TH','FR','SA'])[d + 1], ',' order by d)
        from (select distinct value::int as d
              from jsonb_array_elements_text(coalesce(p_recurrence -> 'days', '[]'::jsonb))
              where value ~ '^[0-6]$') s), ''), 'FREQ=WEEKLY;BYDAY=')
  end;
$$;

-- O feed inteiro, ou null se o token não existe. p_origin (ex.: https://tasker.wavdev.org) monta
-- os links de volta para o app; fora do formato, os eventos vão sem link.
create function public.calendar_ics(p_token text, p_origin text default null)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_tz text;
  v_today date;
  v_origin text;
  v_stamp text := to_char(now() at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"');
  v_lines text[] := array[]::text[];
  r record;
begin
  if p_token is null or length(p_token) not between 20 and 64 then
    return null;
  end if;
  select f.user_id, coalesce(p.timezone, 'America/Sao_Paulo') into v_user, v_tz
  from public.calendar_feeds f join public.profiles p on p.id = f.user_id
  where f.token = p_token;
  if v_user is null then
    return null;
  end if;
  v_today := (now() at time zone v_tz)::date;
  v_origin := case when p_origin ~ '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' then p_origin end;

  v_lines := array['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Questlist//Calendario//PT-BR',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Questlist', 'X-WR-TIMEZONE:' || v_tz,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];

  for r in
    with recursive mine as (
      select m.folder_id as id
      from public.folder_members m
      join public.folders f on f.id = m.folder_id
      where m.user_id = v_user and f.parent_id is null
      union
      select c.id from public.folders c join mine on c.parent_id = mine.id
    ),
    items as (
      select t.id, t.title, t.status, t.due_date, t.recurrence, t.position, t.page_id, p.name as page_name,
             (p.view_type = 'cards' or f.is_gym or coalesce(pf.is_gym, false)) as workout
      from public.tasks t
      join public.pages p on p.id = t.page_id
      join public.folders f on f.id = p.folder_id
      left join public.folders pf on pf.id = f.parent_id
      where t.folder_id in (select id from mine)
        and t.parent_task_id is null
        and t.due_date is not null
        and p.view_type <> 'habits'
        -- Sem recorrência, só o que venceu nos últimos 60 dias em diante (o feed não cresce sem fim)
        and (t.recurrence is not null or t.due_date >= v_today - 60)
    )
    -- Tarefas avulsas: concluída sai
    select 'task' as kind, i.id::text as uid, i.title as summary, i.due_date, i.recurrence,
           null::text as description, '/task/' || i.id as path
    from items i
    where not i.workout and (i.status <> 'done' or i.recurrence is not null)
    union all
    -- Treino: um evento por página e por data (ou regra), com os exercícios na descrição
    select 'workout', i.page_id::text || '-' || left(md5(i.due_date::text || coalesce(i.recurrence::text, '')), 12),
           '🏋 ' || i.page_name, i.due_date, i.recurrence,
           string_agg(i.title, E'\n' order by i.position), '/page/' || i.page_id
    from items i
    where i.workout
    group by i.page_id, i.page_name, i.due_date, i.recurrence
    order by 4, 3
  loop
    v_lines := v_lines || array['BEGIN:VEVENT',
      'UID:' || r.uid || '@questlist',
      'DTSTAMP:' || v_stamp,
      'DTSTART;VALUE=DATE:' || to_char(r.due_date, 'YYYYMMDD'),
      'DTEND;VALUE=DATE:' || to_char(r.due_date + 1, 'YYYYMMDD'),
      'SUMMARY:' || public._ics_text(r.summary),
      'TRANSP:TRANSPARENT'];
    if r.recurrence is not null and public._ics_rrule(r.recurrence, r.due_date) is not null then
      v_lines := v_lines || ('RRULE:' || public._ics_rrule(r.recurrence, r.due_date));
    end if;
    if r.description is not null or v_origin is not null then
      v_lines := v_lines || ('DESCRIPTION:' || public._ics_text(concat_ws(E'\n\n', r.description,
        case when v_origin is not null then v_origin || r.path end)));
    end if;
    if v_origin is not null then
      v_lines := v_lines || ('URL:' || v_origin || r.path);
    end if;
    v_lines := v_lines || 'END:VEVENT'::text;
  end loop;

  v_lines := v_lines || 'END:VCALENDAR'::text;
  return (select string_agg(public._ics_fold(l), E'\r\n' order by n)
          from unnest(v_lines) with ordinality as u (l, n)) || E'\r\n';
end;
$$;

revoke execute on function public.calendar_feed_link(boolean), public.calendar_feed_off(),
  public.calendar_ics(text, text), public._ics_text(text), public._ics_fold(text),
  public._ics_rrule(jsonb, date) from public, anon, authenticated;
grant execute on function public.calendar_feed_link(boolean), public.calendar_feed_off() to authenticated;
-- O feed é pedido sem login (pelo Google): só o token decide
grant execute on function public.calendar_ics(text, text) to anon, authenticated;
