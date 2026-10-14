-- V3 §2.1 (H1): dependências entre tarefas (término → início, com atraso opcional). Uma tarefa
-- depende de outras do mesmo projeto; `deps_mode` diz se precisa de todas ('all') ou de uma
-- ('any'). Sem ciclo: a mensagem mostra o caminho circular.

alter table public.tasks add column deps_mode text not null default 'all' check (deps_mode in ('all', 'any'));
grant insert (deps_mode), update (deps_mode) on public.tasks to authenticated;

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  lag_minutes integer not null default 0 check (lag_minutes between 0 and 525600),
  -- Pasta da tarefa (preenchida pelo trigger), para a RLS e o sync
  folder_id uuid not null references public.folders (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);
create index task_dependencies_depends_on_idx on public.task_dependencies (depends_on_task_id);
create index task_dependencies_folder_idx on public.task_dependencies (folder_id);

-- Caminho de `p_from` até `p_to` seguindo "depende de" (A depende de B: A → B), ou null
create function public.dependency_path(p_from uuid, p_to uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  with recursive caminho(id, trilha) as (
    select p_from, array[p_from]
    union all
    select d.depends_on_task_id, c.trilha || d.depends_on_task_id
    from caminho c join public.task_dependencies d on d.task_id = c.id
    where not d.depends_on_task_id = any (c.trilha) and cardinality(c.trilha) < 200
  )
  select trilha from caminho where id = p_to limit 1;
$$;

create function public.task_dependencies_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_other public.tasks;
  v_path uuid[];
begin
  select * into v_task from public.tasks where id = new.task_id;
  select * into v_other from public.tasks where id = new.depends_on_task_id;
  if v_task.id is null or v_other.id is null then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if public.folder_root(v_task.folder_id) <> public.folder_root(v_other.folder_id) then
    raise exception 'Dependências só entre tarefas do mesmo projeto' using errcode = '22023';
  end if;
  new.folder_id := v_task.folder_id;

  -- Ciclo: a outra tarefa já depende (direta ou indiretamente) desta
  v_path := public.dependency_path(new.depends_on_task_id, new.task_id);
  if v_path is not null then
    raise exception 'Isso criaria um ciclo: %',
      (select string_agg(t.title, ' → ' order by u.n)
       from unnest(array[new.task_id] || v_path) with ordinality u(id, n)
       join public.tasks t on t.id = u.id)
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger task_dependencies_before_write
  before insert or update of task_id, depends_on_task_id, lag_minutes on public.task_dependencies
  for each row execute function public.task_dependencies_before_write();

-- Tarefa que muda de projeto leva junto o folder_id das suas dependências
create function public.tasks_dependencies_follow()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.task_dependencies set folder_id = new.folder_id where task_id = new.id;
  return null;
end;
$$;

create trigger tasks_dependencies_follow
  after update of folder_id on public.tasks
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.tasks_dependencies_follow();

alter table public.task_dependencies enable row level security;

create policy "task_dependencies_select" on public.task_dependencies for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "task_dependencies_insert" on public.task_dependencies for insert to authenticated
  with check (public.has_permission(folder_id, 'dependency.manage'));
create policy "task_dependencies_update" on public.task_dependencies for update to authenticated
  using (public.has_permission(folder_id, 'dependency.manage'))
  with check (public.has_permission(folder_id, 'dependency.manage'));
create policy "task_dependencies_delete" on public.task_dependencies for delete to authenticated
  using (public.has_permission(folder_id, 'dependency.manage'));

revoke all on public.task_dependencies from anon, authenticated;
grant select, delete on public.task_dependencies to authenticated;
grant insert (id, task_id, depends_on_task_id, lag_minutes) on public.task_dependencies to authenticated;
grant update (lag_minutes) on public.task_dependencies to authenticated;
grant execute on function public.dependency_path(uuid, uuid) to authenticated;

alter publication powersync add table public.task_dependencies;
alter publication supabase_realtime add table public.task_dependencies;
