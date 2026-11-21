-- GP1 (D313, ESCOPO_V12 §3): reuniões. Uma reunião é uma lista do tipo 'meeting': os itens da pauta
-- são as tarefas dela (RLS, sync, Realtime e offline de sempre) e o resto (data, hora, duração,
-- lugar, participantes, estado, item atual, ata, ações) fica em pages.config.meeting
-- (lib/meeting.ts). A ata é uma anotação gerada; as ações viram tarefas de verdade no projeto.

alter type public.page_view_type add value if not exists 'meeting';

-- Permissão nova: criar, editar a pauta, conduzir e encerrar (o espelho é lib/permissions.ts)
create or replace function public.permission_presets()
returns jsonb
language sql immutable
as $$
  select $json${
  "presets": {
    "owner": ["project.view", "project.delete", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth", "expense.write", "meeting.manage"],
    "manager": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth", "expense.write", "meeting.manage"],
    "editor": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "expense.write", "meeting.manage"],
    "contributor": ["project.view", "comment.create", "task.create", "task.complete:own", "task.start:own", "task.delete:own", "item.check:own", "item.log:own", "timer.use:own", "expense.write:own"],
    "viewer": ["project.view", "comment.create"],
    "executor": ["project.view", "comment.create", "item.check", "item.log", "timer.use"]
  },
  "own": {"task.complete": "assigned", "task.start": "assigned", "item.check": "assigned", "item.log": "assigned", "timer.use": "assigned", "task.delete": "created", "expense.write": "created"}
}$json$::jsonb;
$$;

-- A reunião ocupa a agenda de quem participa (reservas, AG2, e achar horário, AG3)
CREATE OR REPLACE FUNCTION public._agenda_busy(p_owner uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_ignore uuid)
 RETURNS tstzrange[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    union all
    -- GP1: reuniões não encerradas em que a pessoa participa (data e hora no fuso da pasta)
    select tstzrange(s, s + make_interval(mins => coalesce((m ->> 'duration')::integer, 60)))
    from public.pages pg
    cross join lateral (select pg.config -> 'meeting' as m) mm
    cross join lateral (select ((m ->> 'date')::date + (m ->> 'time')::time)
                                 at time zone public.folder_timezone(pg.folder_id) as s) x
    where pg.view_type::text = 'meeting'
      and m ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' and m ->> 'time' ~ '^\d{2}:\d{2}$'
      and coalesce(m ->> 'status', 'planned') <> 'done'
      and jsonb_typeof(m -> 'participants') = 'array' and (m -> 'participants') ? p_owner::text
      and (m ->> 'date')::date between (p_from at time zone 'UTC')::date - 1 and (p_to at time zone 'UTC')::date + 1
      and s < p_to and s + make_interval(mins => coalesce((m ->> 'duration')::integer, 60)) > p_from
  ) busy;
$function$;
