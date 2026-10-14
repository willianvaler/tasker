-- V3 §2.2 (H2): estado de execução derivado. Espelho de src/lib/task-state.ts (mesmos casos de
-- teste). `started_at` marca "em andamento" (o botão Iniciar vem na H3).

alter table public.tasks add column started_at timestamptz;

-- Uma ligação está atendida: pré-requisito concluído e o atraso já passou (o que sumiu não segura)
create function public._dependency_ok(p_dep public.task_dependencies, p_now timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select t.status = 'done' and t.completed_at is not null
           and t.completed_at + make_interval(mins => p_dep.lag_minutes) <= p_now
    from public.tasks t where t.id = p_dep.depends_on_task_id
  ), true);
$$;

-- Bloqueada por esta tarefa ou por alguma mãe acima dela?
create function public.task_blockers(p_task_id uuid, p_now timestamptz default now())
returns uuid[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_level public.tasks;
  v_open uuid[];
  v_total integer;
  v_waiting uuid[] := '{}';
  v_guard integer := 0;
begin
  select * into v_level from public.tasks where id = p_task_id;
  while v_level.id is not null and v_guard < 10 loop
    v_guard := v_guard + 1;
    select count(*), coalesce(array_agg(d.depends_on_task_id) filter (where not public._dependency_ok(d, p_now)), '{}')
    into v_total, v_open
    from public.task_dependencies d where d.task_id = v_level.id;
    if v_total > 0 and (
      (v_level.deps_mode = 'any' and cardinality(v_open) = v_total)
      or (v_level.deps_mode <> 'any' and cardinality(v_open) > 0)) then
      v_waiting := v_waiting || v_open;
    end if;
    exit when v_level.parent_task_id is null;
    select * into v_level from public.tasks where id = v_level.parent_task_id;
  end loop;
  return v_waiting;
end;
$$;

create function public.task_state(p_task_id uuid, p_now timestamptz default now())
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when t.id is null then 'ready'
    when t.status = 'done' then 'done'
    when cardinality(public.task_blockers(t.id, p_now)) > 0 then 'blocked'
    when t.started_at is not null then 'doing'
    else 'ready'
  end
  from (select 1) x left join public.tasks t on t.id = p_task_id;
$$;

grant execute on function public.task_state(uuid, timestamptz) to authenticated;
grant execute on function public.task_blockers(uuid, timestamptz) to authenticated;
