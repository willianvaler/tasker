-- V3 §2.7 (I6): indicadores do fluxo a partir da auditoria (task_events), nos últimos 90 dias.
-- Tempo esperando bloqueio (passou a esperar → ficou pronta), até começar (criada ou pronta →
-- iniciada) e fazendo (iniciada → concluída). Mesma permissão da linha do tempo.

create function public.project_flow_stats(p_root uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '90 days';
begin
  if not public.can_view_audit(p_root) then
    raise exception 'Sem acesso à auditoria deste projeto' using errcode = '42501';
  end if;
  return (
    with ev as (
      select task_id, kind, at from public.task_events where root_id = p_root and at >= v_since
    ),
    waiting as (
      select extract(epoch from (
        select min(r.at) from ev r where r.task_id = b.task_id and r.kind = 'ready' and r.at > b.at
      ) - b.at) / 60 as minutes
      from ev b where b.kind = 'blocked'
    ),
    to_start as (
      select extract(epoch from s.at - (
        select max(p.at) from ev p where p.task_id = s.task_id and p.kind in ('created', 'ready') and p.at < s.at
      )) / 60 as minutes
      from ev s where s.kind = 'started'
    ),
    doing as (
      select extract(epoch from c.at - (
        select max(p.at) from ev p where p.task_id = c.task_id and p.kind = 'started' and p.at < c.at
      )) / 60 as minutes
      from ev c where c.kind = 'completed'
    )
    select jsonb_build_object(
      'waiting', (select jsonb_build_object('minutes', round(avg(minutes)), 'count', count(minutes)) from waiting),
      'to_start', (select jsonb_build_object('minutes', round(avg(minutes)), 'count', count(minutes)) from to_start),
      'doing', (select jsonb_build_object('minutes', round(avg(minutes)), 'count', count(minutes)) from doing)
    )
  );
end;
$$;

grant execute on function public.project_flow_stats(uuid) to authenticated;
