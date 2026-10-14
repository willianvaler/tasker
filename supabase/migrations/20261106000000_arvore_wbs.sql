-- V3 §1 (G1): árvore de subtarefas (WBS). A tarefa raiz é o nível 1; o limite padrão é 5 níveis
-- (D98), configurável por página e por projeto entre 2 e 6. O servidor é a autoridade: valida
-- profundidade, ciclo e filhos por tarefa em toda escrita. Espelho dos números em
-- src/config/limits.ts (o teste compara).

create function public.tree_limits()
returns jsonb
language sql immutable
as $$
  select '{"default_max_depth": 5, "min_max_depth": 2, "hard_max_depth": 6, "max_children_per_task": 50}'::jsonb;
$$;

alter table public.tasks add column depth smallint not null default 1;
alter table public.pages add column max_depth smallint
  check (max_depth is null or max_depth between 2 and 6);
alter table public.folders add column max_depth smallint
  check (max_depth is null or max_depth between 2 and 6);

-- Profundidade das tarefas que já existem (até hoje, no máximo 2 níveis)
update public.tasks c set depth = 2 from public.tasks p where c.parent_task_id = p.id and c.depth <> 2;

-- Limite que vale para a página: o dela, senão o do projeto (pasta raiz), senão o padrão
create function public.page_max_depth(p_page_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.max_depth, r.max_depth, (public.tree_limits() ->> 'default_max_depth')::int)
  from public.pages p
  join public.folders f on f.id = p.folder_id
  join public.folders r on r.id = coalesce(f.parent_id, f.id)
  where p.id = p_page_id;
$$;

-- Quantos níveis o galho que começa nesta tarefa tem (ela mesma conta 1)
create function public.subtree_height(p_task_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  with recursive galho as (
    select id, 1 as h from public.tasks where id = p_task_id
    union all
    select t.id, g.h + 1 from public.tasks t join galho g on t.parent_task_id = g.id where g.h < 12
  )
  select coalesce(max(h), 1) from galho;
$$;

create or replace function public.tasks_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_parent public.tasks;
  v_max integer;
  v_height integer := 1;
  v_limit integer := (public.tree_limits() ->> 'max_children_per_task')::int;
begin
  if new.parent_task_id is null then
    new.depth := 1;
  elsif tg_op = 'INSERT' or new.parent_task_id is distinct from old.parent_task_id
        or new.page_id is distinct from old.page_id then
    if new.parent_task_id = new.id then
      raise exception 'Uma tarefa não pode ser subtarefa dela mesma' using errcode = '22023';
    end if;
    select * into v_parent from public.tasks where id = new.parent_task_id;
    if v_parent.id is null then
      raise exception 'Tarefa mãe não encontrada' using errcode = 'P0002';
    end if;
    -- Ciclo: a nova mãe não pode estar dentro do galho desta tarefa
    if tg_op = 'UPDATE' and exists (
      with recursive acima as (
        select id, parent_task_id from public.tasks where id = new.parent_task_id
        union
        select t.id, t.parent_task_id from public.tasks t join acima a on t.id = a.parent_task_id
      )
      select 1 from acima where id = new.id) then
      raise exception 'Uma tarefa não pode ficar dentro de uma subtarefa dela' using errcode = '22023';
    end if;
    new.page_id := v_parent.page_id;
    new.depth := v_parent.depth + 1;
    if tg_op = 'UPDATE' then
      v_height := public.subtree_height(new.id);
    end if;
    v_max := public.page_max_depth(new.page_id);
    if new.depth + v_height - 1 > v_max then
      raise exception 'Isso passaria de % níveis. Suba um nível ou aumente o limite do projeto.', v_max
        using errcode = '22023';
    end if;
    if (select count(*) from public.tasks where parent_task_id = new.parent_task_id and id <> new.id) >= v_limit then
      raise exception 'Uma tarefa pode ter no máximo % subtarefas', v_limit using errcode = '22023';
    end if;
  end if;

  select p.folder_id into new.folder_id from public.pages p where p.id = new.page_id;
  if new.folder_id is null then
    raise exception 'Página não encontrada';
  end if;

  new.labels := public.normalize_labels(new.labels);
  new.updated_at := now();
  return new;
end;
$$;

-- Galho movido (outra mãe ou para a raiz): a profundidade dos descendentes acompanha
create function public.tasks_after_reparent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tasks c set depth = new.depth + 1
  where c.parent_task_id = new.id and c.depth <> new.depth + 1;
  return null;
end;
$$;

-- Sem lista de colunas: quem muda a profundidade é o trigger de antes, e "update of" só vê o SET
create trigger tasks_after_reparent
  after update on public.tasks
  for each row when (old.depth is distinct from new.depth)
  execute function public.tasks_after_reparent();

-- Galho que muda de página leva o limite da página nova: confere antes
create function public.tasks_check_page_limit()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_max integer;
begin
  if new.parent_task_id is null and new.page_id is distinct from old.page_id then
    v_max := public.page_max_depth(new.page_id);
    if public.subtree_height(new.id) > v_max then
      raise exception 'Isso passaria de % níveis na página de destino. Suba um nível ou aumente o limite.', v_max
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_check_page_limit
  before update of page_id on public.tasks
  for each row execute function public.tasks_check_page_limit();

-- Baixar o limite abaixo do que já existe é bloqueado, dizendo quais tarefas passam
create function public._depth_overflow(p_page_ids uuid[], p_limit integer)
returns text
language sql stable security definer set search_path = ''
as $$
  select string_agg(format('"%s" (nível %s)', title, depth), ', ' order by depth desc, title)
  from (
    select title, depth from public.tasks
    where page_id = any (p_page_ids) and depth > p_limit
    order by depth desc, title limit 5
  ) x;
$$;

create function public.pages_check_max_depth()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_over text;
begin
  if new.max_depth is distinct from old.max_depth or new.folder_id is distinct from old.folder_id then
    v_over := public._depth_overflow(array[new.id], public.page_max_depth(new.id));
    if v_over is not null then
      raise exception 'O limite ficaria abaixo do que já existe: %', v_over using errcode = '22023';
    end if;
  end if;
  return null;
end;
$$;

create trigger pages_check_max_depth
  after update of max_depth, folder_id on public.pages
  for each row execute function public.pages_check_max_depth();

create function public.folders_check_max_depth()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_over text;
begin
  if new.max_depth is distinct from old.max_depth then
    v_over := (
      select string_agg(o, ', ') from (
        select public._depth_overflow(array[p.id], public.page_max_depth(p.id)) as o
        from public.pages p join public.folders f on f.id = p.folder_id
        where coalesce(f.parent_id, f.id) = new.id
      ) x where o is not null);
    if v_over is not null then
      raise exception 'O limite ficaria abaixo do que já existe: %', v_over using errcode = '22023';
    end if;
  end if;
  return null;
end;
$$;

create trigger folders_check_max_depth
  after update of max_depth on public.folders
  for each row execute function public.folders_check_max_depth();

-- Duplicar página copia a árvore inteira, nível por nível
create or replace function public.duplicate_page(p_page_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_new_id uuid := gen_random_uuid();
  v_level integer;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if v_page.is_inbox or v_page.is_habits then
    raise exception 'Esta página não pode ser duplicada' using errcode = '22023';
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position, max_depth)
  values (v_new_id, v_page.folder_id, coalesce(nullif(trim(p_name), ''), v_page.name || ' (cópia)'),
          v_page.icon, v_page.view_type, v_page.reset_cycle, v_page.position + 0.5, v_page.max_depth);

  drop table if exists _dup_map;
  create temp table _dup_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;

  for v_level in 1 .. (public.tree_limits() ->> 'hard_max_depth')::int loop
    insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                              position, meta, habit_kind, habit_target, created_by)
    select m.new_id, v_new_id, pm.new_id, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
           t.position, t.meta, t.habit_kind, t.habit_target, auth.uid()
    from public.tasks t
    join _dup_map m on m.old_id = t.id
    left join _dup_map pm on pm.old_id = t.parent_task_id
    where t.page_id = p_page_id and t.depth = v_level;
  end loop;

  return v_new_id;
end;
$$;

-- Lixeira: restaura as tarefas de cima para baixo (a mãe antes da filha, em qualquer nível)
create or replace function public.restore_deleted(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.deleted_items;
  v_row public.deleted_items;
  v_count integer := 0;
begin
  select * into v_item from public.deleted_items where id = p_id;
  if v_item.id is null
     or not (v_item.deleted_by = auth.uid() or public.is_folder_member(v_item.root_folder_id, 'editor')) then
    raise exception 'Item não encontrado na lixeira' using errcode = 'P0002';
  end if;

  for v_row in
    select * from public.deleted_items where batch = v_item.batch
    order by case kind when 'folders' then 0 when 'folder_members' then 1 when 'pages' then 2
                       when 'tasks' then 3 else 4 end,
             (payload ->> 'parent_id') is not null,
             coalesce((payload ->> 'depth')::int,
                      case when payload ->> 'parent_task_id' is null then 1 else 2 end),
             deleted_at
  loop
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
      v_row.kind, v_row.kind)
    using v_row.payload;
    v_count := v_count + 1;
  end loop;
  delete from public.deleted_items where batch = v_item.batch;
  return v_count;
end;
$$;

grant update (max_depth) on public.pages to authenticated;
grant update (max_depth) on public.folders to authenticated;
grant execute on function public.tree_limits() to authenticated;
grant execute on function public.page_max_depth(uuid) to authenticated;
