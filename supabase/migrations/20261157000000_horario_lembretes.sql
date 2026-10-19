-- Horário nas tarefas e lembretes (pedido do dono em 19/10/2026, D206).
-- due_time é a hora no fuso de quem criou; remind_before, quantos minutos antes avisar (null: não
-- avisa). O servidor cria a notificação (🔔 e push) por pg_cron; o celular também agenda a sua,
-- local, que toca sem internet e com o app fechado.

alter table public.tasks
  add column due_time time,
  add column remind_before integer check (remind_before between 0 and 10080),
  -- Já avisou deste vencimento (volta a null quando a data, a hora ou o lembrete mudam)
  add column reminded_at timestamptz;
grant insert (due_time, remind_before), update (due_time, remind_before) on public.tasks to authenticated;

create index tasks_reminder_due_idx on public.tasks (due_date)
  where due_time is not null and remind_before is not null and reminded_at is null and status <> 'done';

create function public._reset_reminder()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
     or new.remind_before is distinct from old.remind_before then
    new.reminded_at := null;
  end if;
  -- Sem data, sem hora
  if new.due_date is null then
    new.due_time := null;
  end if;
  return new;
end;
$$;
create trigger tasks_reset_reminder before update on public.tasks
  for each row execute function public._reset_reminder();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder'));

-- A cada minuto: lembretes que venceram (até 1 dia de atraso, para não avisar coisa velha)
create function public.send_task_reminders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_task record;
  v_count integer := 0;
begin
  for v_task in
    select t.id, t.title, t.page_id, t.due_date, t.due_time, t.created_by
    from public.tasks t
    join public.profiles p on p.id = t.created_by
    where t.due_time is not null and t.remind_before is not null and t.reminded_at is null
      and t.status <> 'done' and t.due_date between current_date - 2 and current_date + 8
      and ((t.due_date + t.due_time) at time zone coalesce(p.timezone, 'America/Sao_Paulo'))
          - make_interval(mins => t.remind_before) between now() - interval '1 day' and now()
    for update of t skip locked
  loop
    update public.tasks set reminded_at = now() where id = v_task.id;
    -- Para quem é responsável; sem responsável, para quem criou
    insert into public.notifications (user_id, kind, payload)
    select u, 'task_reminder', jsonb_build_object('task_id', v_task.id, 'title', v_task.title,
      'page_id', v_task.page_id, 'due_date', v_task.due_date, 'due_time', to_char(v_task.due_time, 'HH24:MI'))
    from (select a.user_id as u from public.task_assignees a where a.task_id = v_task.id and a.user_id is not null
          union select v_task.created_by
          where not exists (select 1 from public.task_assignees a where a.task_id = v_task.id and a.user_id is not null)) r;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_task_reminders(), public._reset_reminder() from public, anon, authenticated;
select cron.schedule('questlist-lembretes', '* * * * *', 'select public.send_task_reminders()');

CREATE OR REPLACE FUNCTION public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_kind text;
  v_key text;
  v_completion uuid;
  v_page public.pages;
  v_task public.tasks;
  v_recurrence jsonb := case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end;
  v_habit_kind text := coalesce(p_item ->> 'habit_kind', 'check');
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_done then
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_recurrence);
    v_key := public.cycle_key_for(v_kind, public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, due_time, remind_before, labels, recurrence, meta, position,
    habit_kind, habit_target, created_by, status, completed_by, completed_at, done_cycle_key, repeat_plan
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    -- Horário e lembrete (D206): só com data
    case when p_item ->> 'due_date' is not null then (p_item ->> 'due_time')::time end,
    case when p_item ->> 'due_date' is not null and p_item ->> 'due_time' is not null
         then (p_item ->> 'remind_before')::integer end,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    v_recurrence,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    v_habit_kind,
    case when v_habit_kind = 'counter' then coalesce((p_item ->> 'habit_target')::smallint, 1) end,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key,
    case when jsonb_typeof(p_item -> 'repeat_plan') = 'object' then p_item -> 'repeat_plan' end
  )
  returning * into v_task;
  v_id := v_task.id;

  -- Responsáveis: o trigger confere que o user_id é membro; nome pendente é livre
  insert into public.task_assignees (task_id, user_id, pending_name)
  select v_id, (a ->> 'user_id')::uuid, case when a ? 'user_id' then null else a ->> 'pending_name' end
  from jsonb_array_elements(case when jsonb_typeof(p_item -> 'assignees') = 'array' then p_item -> 'assignees' else '[]' end) a
  on conflict do nothing;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_id, v_task.folder_id, auth.uid(), v_key)
    returning id into v_completion;
    perform public._award_completion(v_task, v_page, v_completion, v_kind, true);
    perform public._refresh_profile_stats(auth.uid());
  end if;
  return v_id;
end;
$function$;

-- O feed do calendário leva o horário (evento de 30 min) quando a tarefa tem um
CREATE OR REPLACE FUNCTION public.calendar_ics(p_token text, p_origin text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      select t.id, t.title, t.status, t.due_date, t.due_time, t.recurrence, t.position, t.page_id, p.name as page_name,
             (p.view_type = 'cards' or f.is_gym or f.gym_group
               or coalesce(pf.is_gym or pf.gym_group, false)) as workout
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
    -- Tarefas avulsas: concluída fica, com ✓ (como no calendário do app); a recorrente segue aberta
    select 'task' as kind, i.id::text as uid,
           case when i.status = 'done' and i.recurrence is null then '✓ ' else '' end || i.title as summary,
           i.due_date, i.recurrence, null::text as description, '/task/' || i.id as path, i.due_time
    from items i
    where not i.workout
    union all
    -- Treino: um evento por página e por data (ou regra), com os exercícios na descrição
    select 'workout', i.page_id::text || '-' || left(md5(i.due_date::text || coalesce(i.recurrence::text, '')), 12),
           '🏋 ' || i.page_name, i.due_date, i.recurrence,
           string_agg(i.title, E'\n' order by i.position), '/page/' || i.page_id, null::time
    from items i
    where i.workout
    group by i.page_id, i.page_name, i.due_date, i.recurrence
    order by 4, 3
  loop
    v_lines := v_lines || array['BEGIN:VEVENT',
      'UID:' || r.uid || '@questlist',
      'DTSTAMP:' || v_stamp,
      -- Com horário (D206): 30 min a partir da hora, no fuso do perfil, em UTC; sem horário, o dia todo
      case when r.due_time is null then 'DTSTART;VALUE=DATE:' || to_char(r.due_date, 'YYYYMMDD')
           else 'DTSTART:' || to_char(((r.due_date + r.due_time) at time zone v_tz) at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"') end,
      case when r.due_time is null then 'DTEND;VALUE=DATE:' || to_char(r.due_date + 1, 'YYYYMMDD')
           else 'DTEND:' || to_char(((r.due_date + r.due_time) at time zone v_tz + interval '30 minutes') at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"') end,
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
$function$;
