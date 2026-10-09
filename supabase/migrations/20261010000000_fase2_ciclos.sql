-- Fase 2: histórico de conclusões, reset por ciclo (cards), hábitos, recorrência e duplicar página.
--
-- Ciclos (D24). Cada tarefa tem um "tipo de ciclo", que diz quando a marcação expira:
--   habits      → pela recorrência do hábito: daily (padrão), weekly, monthly ou weekdays (por dia)
--   cards/list com reset_cycle daily | weekly | manual → o ciclo da página
--   o resto     → 'once' (nunca expira)
-- A chave do ciclo ('2026-10-08', '2026-W41', '2026-10', 'm3', 'once') é calculada no fuso do dono da pasta.
-- Tarefa concluída guarda a chave em done_cycle_key; quando a chave atual muda, refresh_cycles() a reabre.
--
-- Recorrência fora de hábitos (D25): concluir avança o due_date para a próxima ocorrência e a tarefa
-- continua aberta (mesma linha); o histórico fica em task_completions com a data anterior, para desfazer.

-- ============================================================
-- Colunas novas
-- ============================================================

alter table public.pages add column manual_cycle integer not null default 0;
alter table public.tasks add column done_cycle_key text;

revoke update on public.pages from authenticated;
grant update (folder_id, name, icon, view_type, reset_cycle, position) on public.pages to authenticated;

-- ============================================================
-- Histórico
-- ============================================================

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  completed_at timestamptz not null default now(),
  cycle_key text not null,
  -- Só em tarefa recorrente comum: vencimento antes de avançar (para o desfazer)
  prev_due_date date,
  unique (task_id, cycle_key)
);
create index task_completions_task_id_completed_at_idx on public.task_completions (task_id, completed_at desc);
create index task_completions_folder_id_idx on public.task_completions (folder_id);

alter table public.task_completions enable row level security;
revoke all on public.task_completions from anon, authenticated;
grant select on public.task_completions to authenticated;
create policy "task_completions_select" on public.task_completions for select to authenticated
  using (public.is_folder_member(folder_id));

-- ============================================================
-- Funções de ciclo
-- ============================================================

create function public.task_cycle_kind(
  p_view_type public.page_view_type, p_reset_cycle public.page_reset_cycle, p_recurrence jsonb
)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_view_type = 'habits' then
      case p_recurrence ->> 'type' when 'weekly' then 'weekly' when 'monthly' then 'monthly' else 'daily' end
    when p_reset_cycle in ('daily', 'weekly', 'manual') then p_reset_cycle::text
    else 'once'
  end;
$$;

create function public.cycle_key_for(p_kind text, p_timezone text, p_at timestamptz, p_manual integer)
returns text
language sql stable set search_path = ''
as $$
  select case p_kind
    when 'daily' then to_char(p_at at time zone p_timezone, 'YYYY-MM-DD')
    -- Semana ISO: começa na segunda ("Treino A reinicia toda segunda")
    when 'weekly' then to_char(p_at at time zone p_timezone, 'IYYY-"W"IW')
    when 'monthly' then to_char(p_at at time zone p_timezone, 'YYYY-MM')
    when 'manual' then 'm' || p_manual
    else 'once'
  end;
$$;

-- Fuso do dono da pasta (base dos ciclos e de "hoje" no servidor)
create function public.folder_timezone(p_folder_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.timezone from public.folders f join public.profiles p on p.id = f.owner_id where f.id = p_folder_id),
    'America/Sao_Paulo'
  );
$$;

-- Próximo vencimento de uma tarefa recorrente comum. Nunca cai em hoje ou antes (concluir atrasada
-- não empilha ocorrências no passado). O mesmo cálculo existe em src/lib/parser/dates.ts (nextDueDate).
create function public.next_due_date(p_recurrence jsonb, p_due date, p_today date)
returns date
language plpgsql immutable set search_path = ''
as $$
declare
  v_start date := coalesce(p_due, p_today);
  v_next date;
  v_n integer := 1;
  v_days integer[];
begin
  case p_recurrence ->> 'type'
    when 'daily' then
      v_next := greatest(v_start, p_today) + 1;
    when 'weekly' then
      v_next := v_start + 7;
      while v_next <= p_today loop v_next := v_next + 7; end loop;
    when 'monthly' then
      -- Conta os meses a partir da data original para não "escorregar" (31/01 → 28/02 → 31/03)
      v_next := (v_start + make_interval(months => v_n))::date;
      while v_next <= p_today loop
        v_n := v_n + 1;
        v_next := (v_start + make_interval(months => v_n))::date;
      end loop;
    when 'weekdays' then
      select coalesce(array_agg(d::integer), '{}') into v_days
      from jsonb_array_elements_text(p_recurrence -> 'days') d;
      if cardinality(v_days) = 0 then
        return null;
      end if;
      v_next := greatest(v_start, p_today) + 1;
      while not (extract(dow from v_next)::integer = any (v_days)) loop v_next := v_next + 1; end loop;
    else
      return null;
  end case;
  return v_next;
end;
$$;

-- Reabre as tarefas cuja marcação ficou num ciclo que já passou.
-- Sem página: todas as que o usuário acessa (ou todas, quando roda pelo cron, sem usuário).
create function public.refresh_cycles(p_page_id uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    select t.id
    from public.tasks t
    join public.pages p on p.id = t.page_id
    where t.status = 'done'
      and t.done_cycle_key is not null
      and t.done_cycle_key <> 'once'
      and (p_page_id is null or p.id = p_page_id)
      and (auth.uid() is null or public.is_folder_member(p.folder_id))
      and t.done_cycle_key <> public.cycle_key_for(
        public.task_cycle_kind(p.view_type, p.reset_cycle, t.recurrence),
        public.folder_timezone(p.folder_id), now(), p.manual_cycle
      )
  )
  update public.tasks t
  set status = 'todo', completed_by = null, completed_at = null, done_cycle_key = null
  from stale
  where t.id = stale.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- Concluir / desfazer, agora com histórico, ciclos e recorrência
-- ============================================================

create or replace function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page public.pages;
  v_tz text;
  v_kind text;
  v_key text;
  v_today date;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if v_task.status = 'done' then
    return v_task;
  end if;

  select * into v_page from public.pages where id = v_task.page_id;
  v_tz := public.folder_timezone(v_page.folder_id);
  v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence);
  v_today := (now() at time zone v_tz)::date;

  -- Recorrente comum: registra e avança a data; a tarefa continua aberta
  if v_kind = 'once' and v_task.parent_task_id is null
     and public.next_due_date(v_task.recurrence, v_task.due_date, v_today) is not null then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key, prev_due_date)
    values (v_task.id, v_task.folder_id, auth.uid(), 'r:' || gen_random_uuid(), v_task.due_date);

    update public.tasks
    set due_date = public.next_due_date(v_task.recurrence, v_task.due_date, v_today)
    where id = p_task_id
    returning * into v_task;
    return v_task;
  end if;

  v_key := public.cycle_key_for(v_kind, v_tz, now(), v_page.manual_cycle);
  insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
  values (v_task.id, v_task.folder_id, auth.uid(), v_key)
  on conflict (task_id, cycle_key) do update set completed_at = now(), user_id = excluded.user_id;

  update public.tasks
  set status = 'done', completed_by = auth.uid(), completed_at = now(), done_cycle_key = v_key
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

create or replace function public.uncomplete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_last public.task_completions;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;

  if v_task.status = 'done' then
    delete from public.task_completions where task_id = p_task_id and cycle_key = v_task.done_cycle_key;
    update public.tasks
    set status = 'todo', completed_by = null, completed_at = null, done_cycle_key = null
    where id = p_task_id
    returning * into v_task;
    return v_task;
  end if;

  -- Aberta e recorrente: desfaz a última conclusão (volta a data de antes)
  select * into v_last from public.task_completions
  where task_id = p_task_id and cycle_key like 'r:%'
  order by completed_at desc limit 1;
  if v_last.id is not null then
    delete from public.task_completions where id = v_last.id;
    update public.tasks set due_date = v_last.prev_due_date where id = p_task_id returning * into v_task;
  end if;
  return v_task;
end;
$$;

-- ============================================================
-- Reset manual e duplicar página
-- ============================================================

create function public.reset_page(p_page_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
begin
  select * into v_page from public.pages where id = p_page_id for update;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if v_page.reset_cycle <> 'manual' then
    raise exception 'Só páginas com reset manual são reiniciadas na mão' using errcode = '22023';
  end if;
  update public.pages set manual_cycle = manual_cycle + 1 where id = p_page_id;
  return public.refresh_cycles(p_page_id);
end;
$$;

-- Copia a página (mesma pasta, logo depois da original) com as tarefas e subtarefas, todas abertas
create function public.duplicate_page(p_page_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_new_id uuid := gen_random_uuid();
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.is_folder_member(v_page.folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if v_page.is_inbox then
    raise exception 'A Caixa de entrada não pode ser duplicada' using errcode = '22023';
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position)
  values (v_new_id, v_page.folder_id, coalesce(nullif(trim(p_name), ''), v_page.name || ' (cópia)'),
          v_page.icon, v_page.view_type, v_page.reset_cycle, v_page.position + 0.5);

  -- Mapa de ids antigos → novos, para ligar as subtarefas às mães copiadas
  -- (drop antes: a função pode rodar mais de uma vez na mesma transação)
  drop table if exists _dup_map;
  create temp table _dup_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;

  insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                            position, meta, created_by)
  select m.new_id, v_new_id, null, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
         t.position, t.meta, auth.uid()
  from public.tasks t join _dup_map m on m.old_id = t.id
  where t.parent_task_id is null;

  insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, due_date, labels, recurrence,
                            position, meta, created_by)
  select m.new_id, v_new_id, pm.new_id, t.title, t.notes, t.priority, t.due_date, t.labels, t.recurrence,
         t.position, t.meta, auth.uid()
  from public.tasks t
  join _dup_map m on m.old_id = t.id
  join _dup_map pm on pm.old_id = t.parent_task_id;

  return v_new_id;
end;
$$;

-- ============================================================
-- Lote: aceita meta (séries, repetições, carga dos cards)
-- ============================================================

create or replace function public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_key text;
begin
  if p_parent_id is not null and p_item ? 'children' and jsonb_array_length(p_item -> 'children') > 0 then
    raise exception 'Subtarefa não pode ter subtarefas' using errcode = '22023';
  end if;

  if v_done then
    select public.cycle_key_for(
      public.task_cycle_kind(p.view_type, p.reset_cycle,
        case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end),
      public.folder_timezone(p.folder_id), now(), p.manual_cycle)
    into v_key from public.pages p where p.id = p_page_id;
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, labels, recurrence, meta, position,
    created_by, status, completed_by, completed_at, done_cycle_key
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key
  )
  returning id into v_id;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    select v_id, t.folder_id, auth.uid(), v_key from public.tasks t where t.id = v_id;
  end if;
  return v_id;
end;
$$;

-- ============================================================
-- Permissões das funções novas e cron
-- ============================================================

revoke execute on function public.refresh_cycles(uuid), public.reset_page(uuid), public.duplicate_page(uuid, text)
  from public, anon;
grant execute on function public.refresh_cycles(uuid), public.reset_page(uuid), public.duplicate_page(uuid, text)
  to authenticated;
revoke execute on function public.folder_timezone(uuid) from public, anon;

-- Reabre ciclos vencidos a cada 15 minutos (o app também chama refresh_cycles ao carregar as listas)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('questlist-refresh-cycles', '*/15 * * * *', $$select public.refresh_cycles()$$);
