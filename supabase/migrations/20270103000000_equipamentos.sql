-- Equipamentos e manutenção (ESCOPO_V15 §4 CS1, D365).
--
-- `equipments`: o que a pessoa tem em casa (nome, cômodo, marca, modelo, compra e, se houver, o
-- dispositivo do V14 ligado). `maintenance_plans`: o que fazer em cada um e de quanto em quanto
-- tempo ("Limpar o filtro, a cada 3 meses"). A recorrência das tarefas não conta "depois de
-- concluir", então quem cuida das datas é o plano, no servidor:
--   próxima = último feito + intervalo (sem último feito: hoje, no fuso da pessoa);
--   o plano mantém UMA tarefa aberta (`task_id`), com vencimento na próxima data, na lista escolhida
--   ou na Caixa de entrada;
--   concluir essa tarefa grava o último feito (o dia da conclusão) e abre a seguinte;
--   desfazer a conclusão volta o último feito e apaga a seguinte, se ainda estiver intocada.
-- A ligação plano → tarefa é só `task_id` (o `meta` da tarefa é só para mostrar), então o cliente não
-- consegue fazer outra tarefa "contar" como manutenção. Pessoal e com sync, como os remédios.

create table public.equipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  room text check (char_length(room) <= 60),
  brand text check (char_length(brand) <= 60),
  model text check (char_length(model) <= 80),
  purchased_on date,
  device_id uuid references public.devices (id) on delete set null,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipments_user on public.equipments (user_id, created_at);

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  equipment_id uuid not null references public.equipments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  every_n smallint not null default 1 check (every_n between 1 and 999),
  unit text not null default 'meses' check (unit in ('dias', 'meses')),
  last_done_on date,
  page_id uuid references public.pages (id) on delete set null,
  paused boolean not null default false,
  -- Do servidor
  next_on date,
  task_id uuid references public.tasks (id) on delete set null,
  prev_done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_plans_user on public.maintenance_plans (user_id, created_at);
create index maintenance_plans_equipment on public.maintenance_plans (equipment_id);
create unique index maintenance_plans_task on public.maintenance_plans (task_id) where task_id is not null;

-- O dispositivo ligado tem de ser da pessoa
create function public._own_device(p_device uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_device is null or exists (select 1 from public.devices d where d.id = p_device and d.owner_id = auth.uid());
$$;

alter table public.equipments enable row level security;
revoke all on public.equipments from anon;
revoke insert, update on public.equipments from authenticated;
grant insert (id, name, room, brand, model, purchased_on, device_id, notes),
  update (name, room, brand, model, purchased_on, device_id, notes)
  on public.equipments to authenticated;
create policy "equipments_select" on public.equipments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "equipments_insert" on public.equipments for insert to authenticated
  with check (user_id = (select auth.uid()) and public._own_device(device_id));
create policy "equipments_update" on public.equipments for update to authenticated
  using (user_id = (select auth.uid())) with check (public._own_device(device_id));
create policy "equipments_delete" on public.equipments for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.maintenance_plans enable row level security;
revoke all on public.maintenance_plans from anon;
revoke insert, update on public.maintenance_plans from authenticated;
grant insert (id, equipment_id, name, every_n, unit, last_done_on, page_id, paused),
  update (name, every_n, unit, last_done_on, page_id, paused)
  on public.maintenance_plans to authenticated;
create policy "maintenance_plans_select" on public.maintenance_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "maintenance_plans_insert" on public.maintenance_plans for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.equipments e where e.id = equipment_id and e.user_id = (select auth.uid())));
create policy "maintenance_plans_update" on public.maintenance_plans for update to authenticated
  using (user_id = (select auth.uid()));
create policy "maintenance_plans_delete" on public.maintenance_plans for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.equipments_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger equipments_touch before update on public.equipments
  for each row execute function public.equipments_touch();

-- A próxima data (mesma conta de nextMaintenance em lib/maintenance.ts)
create function public.maintenance_next(p_last date, p_every integer, p_unit text, p_today date)
returns date
language sql immutable set search_path = ''
as $$
  select case
    when p_last is null then p_today
    when p_unit = 'dias' then p_last + p_every
    else (p_last + make_interval(months => p_every))::date
  end;
$$;

-- Antes de gravar o plano: a próxima data e o carimbo
create function public.maintenance_plans_before()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.next_on := public.maintenance_next(new.last_done_on, new.every_n, new.unit, public.user_today(new.user_id));
  new.updated_at := now();
  return new;
end;
$$;
create trigger maintenance_plans_before before insert or update on public.maintenance_plans
  for each row execute function public.maintenance_plans_before();

-- Depois de gravar: uma tarefa aberta por plano ativo, com o vencimento na próxima data
create function public._maintenance_sync_task(p_plan public.maintenance_plans)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page uuid;
  v_equip text;
  v_id uuid;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if p_plan.task_id is not null then
    select * into v_task from public.tasks where id = p_plan.task_id;
  end if;
  -- Parado: a tarefa aberta (intocada) sai
  if p_plan.paused then
    if v_task.id is not null and v_task.status <> 'done' then
      delete from public.tasks where id = v_task.id;
      update public.maintenance_plans set task_id = null where id = p_plan.id;
    end if;
    return;
  end if;
  select name into v_equip from public.equipments where id = p_plan.equipment_id;
  -- Já tem tarefa aberta: só acerta o vencimento e o nome
  if v_task.id is not null and v_task.status <> 'done' then
    if v_task.due_date is distinct from p_plan.next_on
       or v_task.title is distinct from left(p_plan.name || ' · ' || coalesce(v_equip, ''), 500) then
      update public.tasks set due_date = p_plan.next_on,
        title = left(p_plan.name || ' · ' || coalesce(v_equip, ''), 500)
      where id = v_task.id;
    end if;
    return;
  end if;
  -- A lista: a escolhida, se a pessoa ainda pode criar nela; senão, a Caixa de entrada
  select p.id into v_page from public.pages p
  where p.id = p_plan.page_id and public.is_folder_member(p.folder_id, 'editor');
  if v_page is null then
    select p.id into v_page from public.pages p join public.folders f on f.id = p.folder_id
    where p.is_inbox and f.owner_id = p_plan.user_id limit 1;
  end if;
  if v_page is null then
    return;
  end if;
  v_id := gen_random_uuid();
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_plan.user_id, 'role', 'authenticated')::text, true);
  perform public.create_tasks_batch(v_page, jsonb_build_array(jsonb_build_object(
    'id', v_id,
    'title', left(p_plan.name || ' · ' || coalesce(v_equip, ''), 500),
    'due_date', p_plan.next_on,
    'labels', jsonb_build_array('manutencao'),
    'meta', jsonb_build_object('manutencao', jsonb_build_object('plano', p_plan.id, 'equipamento', p_plan.equipment_id)))));
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  update public.maintenance_plans set task_id = v_id where id = p_plan.id;
end;
$$;

create function public.maintenance_plans_after()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- A troca só do task_id (feita aqui mesmo) não precisa de nada
  if tg_op = 'UPDATE' and new.next_on is not distinct from old.next_on
     and new.paused is not distinct from old.paused and new.page_id is not distinct from old.page_id
     and new.name is not distinct from old.name then
    return null;
  end if;
  perform public._maintenance_sync_task(new);
  return null;
end;
$$;
create trigger maintenance_plans_after after insert or update on public.maintenance_plans
  for each row execute function public.maintenance_plans_after();

-- Apagar o plano leva junto a tarefa aberta (a concluída fica no histórico)
create function public.maintenance_plans_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.task_id is not null then
    delete from public.tasks where id = old.task_id and status <> 'done';
  end if;
  return old;
end;
$$;
create trigger maintenance_plans_delete before delete on public.maintenance_plans
  for each row execute function public.maintenance_plans_delete();

-- Concluir a tarefa do plano: último feito = o dia da conclusão, e a seguinte nasce
create function public.maintenance_task_done()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.maintenance_plans;
  v_day date;
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    select * into v_plan from public.maintenance_plans where task_id = new.id;
    if v_plan.id is null then
      return null;
    end if;
    v_day := (coalesce(new.completed_at, now()) at time zone coalesce(
      (select timezone from public.profiles where id = v_plan.user_id), 'America/Sao_Paulo'))::date;
    update public.maintenance_plans
      set prev_done_on = last_done_on, last_done_on = v_day, task_id = null
      where id = v_plan.id;
  elsif old.status = 'done' and new.status <> 'done' then
    -- Desfazer: o plano volta a apontar para esta tarefa, e a seguinte (intocada) sai
    select * into v_plan from public.maintenance_plans p
    where p.user_id = new.created_by and (new.meta #>> '{manutencao,plano}') = p.id::text;
    if v_plan.id is null or v_plan.task_id = new.id then
      return null;
    end if;
    if v_plan.task_id is not null then
      delete from public.tasks t where t.id = v_plan.task_id and t.status = 'todo';
    end if;
    update public.maintenance_plans
      set last_done_on = prev_done_on, task_id = new.id
      where id = v_plan.id;
  end if;
  return null;
end;
$$;
create trigger maintenance_task_done after update of status on public.tasks
  for each row when (new.status is distinct from old.status and (new.status = 'done' or old.status = 'done'))
  execute function public.maintenance_task_done();

revoke execute on function public._own_device(uuid), public._maintenance_sync_task(public.maintenance_plans),
  public.maintenance_plans_before(), public.maintenance_plans_after(), public.maintenance_plans_delete(),
  public.maintenance_task_done(), public.equipments_touch()
  from public, anon, authenticated;
grant execute on function public._own_device(uuid) to authenticated;

alter publication powersync add table public.equipments, public.maintenance_plans;

-- Exportação (LGPD): os equipamentos e os planos entram. A versão anterior vira a base, e esta só
-- acrescenta as chaves novas (a próxima mudança pode fazer o mesmo, em vez de copiar a função inteira)
alter function public.export_my_data() rename to _export_my_data_base;
revoke execute on function public._export_my_data_base() from public, anon, authenticated;
create function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return public._export_my_data_base() || jsonb_build_object(
    'equipments', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.equipments e
                            where e.user_id = v_user), '[]'),
    'maintenance_plans', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.maintenance_plans m
                                   where m.user_id = v_user), '[]'));
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
