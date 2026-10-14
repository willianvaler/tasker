-- V3 §2.3 (I7): dependência entre listas. Uma lista só libera quando a anterior chega a X%
-- concluída (padrão 100%). Enquanto isso, as tarefas dela ficam bloqueadas, com a mesma regra
-- estrita/flexível das tarefas. Progresso = folhas concluídas / folhas (mãe com filhas é pacote);
-- lista vazia não segura ninguém. Espelho de src/lib/page-deps.ts (mesmos casos de teste).

create table public.page_dependencies (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  depends_on_page_id uuid not null references public.pages (id) on delete cascade,
  threshold_pct smallint not null default 100 check (threshold_pct between 1 and 100),
  -- Pasta da lista (preenchida pelo trigger), para a RLS e o sync
  folder_id uuid not null references public.folders (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (page_id, depends_on_page_id),
  check (page_id <> depends_on_page_id)
);
create index page_dependencies_depends_on_idx on public.page_dependencies (depends_on_page_id);
create index page_dependencies_folder_idx on public.page_dependencies (folder_id);

-- Caminho de `p_from` até `p_to` seguindo "depende de", ou null
create function public.page_dependency_path(p_from uuid, p_to uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  with recursive caminho(id, trilha) as (
    select p_from, array[p_from]
    union all
    select d.depends_on_page_id, c.trilha || d.depends_on_page_id
    from caminho c join public.page_dependencies d on d.page_id = c.id
    where not d.depends_on_page_id = any (c.trilha) and cardinality(c.trilha) < 100
  )
  select trilha from caminho where id = p_to limit 1;
$$;

create function public.page_dependencies_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_other public.pages;
  v_path uuid[];
begin
  select * into v_page from public.pages where id = new.page_id;
  select * into v_other from public.pages where id = new.depends_on_page_id;
  if v_page.id is null or v_other.id is null then
    raise exception 'Lista não encontrada' using errcode = 'P0002';
  end if;
  if public.folder_root(v_page.folder_id) <> public.folder_root(v_other.folder_id) then
    raise exception 'Dependências só entre listas do mesmo projeto' using errcode = '22023';
  end if;
  new.folder_id := v_page.folder_id;
  v_path := public.page_dependency_path(new.depends_on_page_id, new.page_id);
  if v_path is not null then
    raise exception 'Isso criaria um ciclo: %',
      (select string_agg(p.name, ' → ' order by u.n)
       from unnest(array[new.page_id] || v_path) with ordinality u(id, n)
       join public.pages p on p.id = u.id)
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger page_dependencies_before_write
  before insert or update of page_id, depends_on_page_id, threshold_pct on public.page_dependencies
  for each row execute function public.page_dependencies_before_write();

-- Lista que muda de pasta leva o folder_id das suas dependências
create function public.pages_dependencies_follow()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.page_dependencies set folder_id = new.folder_id where page_id = new.id;
  return null;
end;
$$;

create trigger pages_dependencies_follow
  after update of folder_id on public.pages
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.pages_dependencies_follow();

alter table public.page_dependencies enable row level security;

create policy "page_dependencies_select" on public.page_dependencies for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "page_dependencies_insert" on public.page_dependencies for insert to authenticated
  with check (public.has_permission(folder_id, 'dependency.manage'));
create policy "page_dependencies_update" on public.page_dependencies for update to authenticated
  using (public.has_permission(folder_id, 'dependency.manage'))
  with check (public.has_permission(folder_id, 'dependency.manage'));
create policy "page_dependencies_delete" on public.page_dependencies for delete to authenticated
  using (public.has_permission(folder_id, 'dependency.manage'));

revoke all on public.page_dependencies from anon, authenticated;
grant select, delete on public.page_dependencies to authenticated;
grant insert (id, page_id, depends_on_page_id, threshold_pct) on public.page_dependencies to authenticated;
grant update (threshold_pct) on public.page_dependencies to authenticated;
grant execute on function public.page_dependency_path(uuid, uuid) to authenticated;

alter publication powersync add table public.page_dependencies;
alter publication supabase_realtime add table public.page_dependencies;

-- Progresso da lista: folhas concluídas e folhas
create function public.page_progress(p_page_id uuid)
returns table (done integer, total integer)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where t.status = 'done')::int, count(*)::int
  from public.tasks t
  where t.page_id = p_page_id
    and not exists (select 1 from public.tasks c where c.parent_task_id = t.id);
$$;

-- Listas que ainda seguram esta (abaixo do percentual pedido)
create function public.page_blockers(p_page_id uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(d.depends_on_page_id), '{}')
  from public.page_dependencies d
  cross join lateral public.page_progress(d.depends_on_page_id) p
  where d.page_id = p_page_id
    and p.total > 0 and p.done * 100 < d.threshold_pct * p.total;
$$;

grant execute on function public.page_progress(uuid) to authenticated;
grant execute on function public.page_blockers(uuid) to authenticated;

-- O estado passa a olhar a lista também
create or replace function public.task_state(p_task_id uuid, p_now timestamptz default now())
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when t.id is null then 'ready'
    when t.status = 'done' then 'done'
    when cardinality(public.task_blockers(t.id, p_now)) > 0 then 'blocked'
    when cardinality(public.page_blockers(t.page_id)) > 0 then 'blocked'
    when t.started_at is not null then 'doing'
    else 'ready'
  end
  from (select 1) x left join public.tasks t on t.id = p_task_id;
$$;

-- Tarefa de lista bloqueada também não começa nem termina (forçar vale igual)
create or replace function public.tasks_respect_blockers()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_waiting uuid[];
  v_pages uuid[];
begin
  if public._app_caller() is null then
    return new;
  end if;
  if not ((new.status in ('doing', 'done') and old.status is distinct from new.status)
          or (new.started_at is not null and old.started_at is null)) then
    return new;
  end if;
  if current_setting('app.force_unblock', true) = new.id::text then
    return new;
  end if;
  v_waiting := public.task_blockers(new.id);
  if cardinality(v_waiting) > 0 then
    raise exception 'Tarefa bloqueada. Aguardando: %',
      (select string_agg(title, ', ') from public.tasks where id = any (v_waiting))
      using errcode = '22023';
  end if;
  v_pages := public.page_blockers(new.page_id);
  if cardinality(v_pages) > 0 then
    raise exception 'Lista bloqueada. Aguardando: %',
      (select string_agg(p.name || ' (' || d.threshold_pct || '%)', ', ')
       from public.page_dependencies d join public.pages p on p.id = d.depends_on_page_id
       where d.page_id = new.page_id and d.depends_on_page_id = any (v_pages))
      using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Mãe que fecharia sozinha, mas está numa lista bloqueada, espera
create or replace function public.tasks_parent_follow()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.tasks;
  v_auto boolean;
begin
  if new.parent_task_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  select * into v_parent from public.tasks where id = new.parent_task_id;
  if v_parent.id is null then
    return null;
  end if;

  if new.status = 'done' and v_parent.status <> 'done' then
    select r.auto_complete_parent into v_auto
    from public.folders f join public.folders r on r.id = coalesce(f.parent_id, f.id)
    where f.id = v_parent.folder_id;
    if coalesce(v_auto, true)
       and not exists (select 1 from public.tasks where parent_task_id = v_parent.id and status <> 'done')
       and cardinality(public.task_blockers(v_parent.id)) = 0
       and cardinality(public.page_blockers(v_parent.page_id)) = 0 then
      perform public.complete_task(v_parent.id);
    end if;
  elsif old.status = 'done' and new.status <> 'done' and v_parent.status = 'done' then
    perform public.uncomplete_task(v_parent.id);
  end if;
  return null;
end;
$$;
