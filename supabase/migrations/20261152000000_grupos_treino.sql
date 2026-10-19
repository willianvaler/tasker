-- Grupos de treino (V6 §15.5, D186): no bloco Academia, "+ Novo grupo de treino" cria uma pasta
-- raiz compartilhável (um projeto com `gym_group`), com convite pelo link como qualquer projeto.
-- A Academia continua pessoal (D182). Dentro do grupo, as páginas são de treino: o seletor "quem
-- treina comigo" (D183), os desafios, o mural e o chat (D184) já funcionam em pasta compartilhada.

alter table public.folders add column gym_group boolean not null default false;
alter table public.folders add constraint folders_gym_group_root
  check (not gym_group or (parent_id is null and kind = 'project' and not is_gym));
-- Só na criação: um grupo não vira pasta comum depois (nem o contrário)
grant insert (gym_group) on public.folders to authenticated;

-- Página de treino: de cards, da Academia ou de um grupo de treino
create or replace function public._is_workout_page(p_page_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.pages p join public.folders f on f.id = p.folder_id
                 left join public.folders r on r.id = f.parent_id
                 where p.id = p_page_id
                   and (p.view_type = 'cards' or f.is_gym or f.gym_group
                        or coalesce(r.is_gym or r.gym_group, false)));
$$;

-- Feed do calendário (C1): o treino de um grupo também vira um evento por dia
create or replace function public.calendar_ics(p_token text, p_origin text default null)
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

-- Exercício com séries no painel e sem plano (o campo "Séries" só gravava meta.sets): ganha o plano
-- de séries com o descanso padrão de 60 s, como o atalho "3x12" já fazia. Sem isso o Modo Treino
-- tratava o exercício como um item só, sem descanso e sem aviso na tela de bloqueio.
update public.tasks
set repeat_plan = jsonb_build_object('mode', 'sets', 'total', least((meta ->> 'sets')::int, 99),
                                     'rest_seconds', 60)
where repeat_plan is null
  and meta ->> 'sets' ~ '^[0-9]{1,4}$'
  and (meta ->> 'sets')::int >= 2;
