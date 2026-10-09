-- Fase 1: datas sem hora, etiquetas, conclusão por RPC e criação em lote.

-- ============================================================
-- Vencimento: data sem hora (D13). Horário entra junto com lembretes, no backlog.
-- ============================================================

drop index public.tasks_due_at_idx;
alter table public.tasks drop column due_at;
alter table public.tasks add column due_date date;
create index tasks_due_date_idx on public.tasks (due_date) where status <> 'done';

-- ============================================================
-- Etiquetas como lista de texto na própria tarefa (D14)
-- ============================================================

alter table public.tasks
  add column labels text[] not null default '{}'
  check (cardinality(labels) <= 20 and array_position(labels, null) is null);
create index tasks_labels_idx on public.tasks using gin (labels);

-- Normaliza as etiquetas: minúsculas, sem #, sem espaços nas pontas, sem repetidas, até 50 caracteres
create function public.normalize_labels(p_labels text[])
returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(distinct l order by l), '{}')
  from (
    select left(lower(trim(both from ltrim(trim(x), '#'))), 50) as l
    from unnest(coalesce(p_labels, '{}')) as x
  ) s
  where l <> '';
$$;

create or replace function public.tasks_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception 'Uma tarefa não pode ser subtarefa dela mesma';
    end if;
    if exists (select 1 from public.tasks t where t.id = new.parent_task_id and t.parent_task_id is not null) then
      raise exception 'Subtarefa não pode ter subtarefas';
    end if;
    select t.page_id into new.page_id from public.tasks t where t.id = new.parent_task_id;
    if new.page_id is null then
      raise exception 'Tarefa mãe não encontrada';
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

-- ============================================================
-- Privilégios: due_date e labels no lugar de due_at
-- ============================================================

revoke insert, update on public.tasks from authenticated;
grant insert (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence, position, meta)
  on public.tasks to authenticated;
grant update (page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence, position, meta)
  on public.tasks to authenticated;

-- ============================================================
-- Fuso horário do perfil precisa existir
-- ============================================================

create function public.profiles_validate()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  new.display_name := trim(new.display_name);
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update of timezone, display_name on public.profiles
  for each row execute function public.profiles_validate();

-- ============================================================
-- Conclusão (D7: o status só muda por aqui). A Fase 3 acrescenta XP e boss nestas funções.
-- ============================================================

create function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.status = 'done' then
    return v_task;
  end if;

  update public.tasks
  set status = 'done', completed_by = auth.uid(), completed_at = now()
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

create function public.uncomplete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.status <> 'done' then
    return v_task;
  end if;

  update public.tasks
  set status = 'todo', completed_by = null, completed_at = null
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

-- ============================================================
-- Criação em lote (também usada para uma tarefa só, vinda da captura rápida)
--
-- p_items: [{ id?, title, priority?, due_date?, labels?, recurrence?, done?, children?: [mesmo formato, sem children] }]
-- Cria tudo numa transação, no fim da página, na ordem recebida. Devolve as tarefas criadas.
-- ============================================================

create function public.create_tasks_batch(p_page_id uuid, p_items jsonb)
returns setof public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid;
  v_position double precision;
  v_total integer := 0;
  v_item jsonb;
  v_child jsonb;
  v_parent_id uuid;
  v_child_id uuid;
  v_child_position double precision;
begin
  select p.folder_id into v_folder_id from public.pages p where p.id = p_page_id;
  if v_folder_id is null or not public.is_folder_member(v_folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhuma tarefa para criar' using errcode = '22023';
  end if;

  select count(*) + coalesce(sum(jsonb_array_length(coalesce(i -> 'children', '[]'))), 0)
  into v_total
  from jsonb_array_elements(p_items) i;
  if v_total > 500 then
    raise exception 'No máximo 500 tarefas por vez' using errcode = '22023';
  end if;

  select coalesce(max(t.position), 0) into v_position
  from public.tasks t where t.page_id = p_page_id and t.parent_task_id is null;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_parent_id := public._insert_batch_task(p_page_id, null, v_item, v_position);
    return query select * from public.tasks where id = v_parent_id;

    v_child_position := 0;
    for v_child in select * from jsonb_array_elements(coalesce(v_item -> 'children', '[]')) loop
      v_child_position := v_child_position + 1;
      -- Em variável: chamada direta no where rodaria a função uma vez por linha da tabela
      v_child_id := public._insert_batch_task(p_page_id, v_parent_id, v_child, v_child_position);
      return query select * from public.tasks where id = v_child_id;
    end loop;
  end loop;
end;
$$;

-- Insere um item do lote (uso interno do create_tasks_batch; sem permissão para o cliente)
create function public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
begin
  if p_parent_id is not null and p_item ? 'children' and jsonb_array_length(p_item -> 'children') > 0 then
    raise exception 'Subtarefa não pode ter subtarefas' using errcode = '22023';
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, labels, recurrence, position,
    created_by, status, completed_by, completed_at
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end,
    p_position,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public._insert_batch_task(uuid, uuid, jsonb, double precision) from public, anon, authenticated;
revoke execute on function public.complete_task(uuid), public.uncomplete_task(uuid), public.create_tasks_batch(uuid, jsonb)
  from public, anon;
grant execute on function public.complete_task(uuid), public.uncomplete_task(uuid), public.create_tasks_batch(uuid, jsonb)
  to authenticated;
