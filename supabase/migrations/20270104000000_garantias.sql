-- Garantias e documentos (ESCOPO_V15 §4 CS3, D367).
--
-- O equipamento ganha a garantia (até uma data, ou N meses a partir da compra) e a nota fiscal, que
-- é um lançamento do V9 (o gasto já guarda a foto da nota, `receipt_path`): nada de arquivo novo. O
-- fim da garantia é do servidor (`warranty_ends_on`). Avisos 30 e 7 dias antes, uma vez cada, pelo
-- pg_cron (de hora em hora, às 9 h no fuso da pessoa), como notificação do app.

alter table public.equipments
  add column warranty_months smallint check (warranty_months between 1 and 240),
  add column warranty_until date,
  add column expense_id uuid references public.expenses (id) on delete set null,
  -- Do servidor
  add column warranty_ends_on date,
  add column warranty_warned smallint,
  add constraint equipments_warranty_one check (warranty_months is null or warranty_until is null);

grant insert (warranty_months, warranty_until, expense_id), update (warranty_months, warranty_until, expense_id)
  on public.equipments to authenticated;

-- A nota fiscal tem de ser um gasto que a pessoa vê (a policy de leitura dos gastos vale aqui dentro)
drop policy "equipments_insert" on public.equipments;
drop policy "equipments_update" on public.equipments;
create policy "equipments_insert" on public.equipments for insert to authenticated
  with check (user_id = (select auth.uid()) and public._own_device(device_id)
              and (expense_id is null or exists (select 1 from public.expenses x where x.id = expense_id)));
create policy "equipments_update" on public.equipments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (public._own_device(device_id)
              and (expense_id is null or exists (select 1 from public.expenses x where x.id = expense_id)));

-- Fim da garantia (mesma conta de warrantyEnd em lib/maintenance.ts): a data dada, ou a compra + meses
create function public.warranty_end(p_until date, p_months integer, p_bought date)
returns date
language sql immutable set search_path = ''
as $$
  select case
    when p_until is not null then p_until
    when p_months is not null and p_bought is not null then (p_bought + make_interval(months => p_months))::date
  end;
$$;

create function public.equipments_warranty()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_end date := public.warranty_end(new.warranty_until, new.warranty_months, new.purchased_on);
begin
  -- Mudou o fim: os avisos recomeçam
  if tg_op = 'INSERT' or v_end is distinct from old.warranty_ends_on then
    new.warranty_warned := null;
  end if;
  new.warranty_ends_on := v_end;
  return new;
end;
$$;
create trigger equipments_warranty before insert or update on public.equipments
  for each row execute function public.equipments_warranty();

-- Avisos: 30 dias antes e 7 dias antes, cada um uma vez (warranty_warned guarda o último dado)
create function public.send_warranty_alerts(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
  v_left integer;
  v_step smallint;
begin
  for r in
    select e.id, e.user_id, e.name, e.warranty_ends_on, e.warranty_warned,
           (p_now at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date as today,
           extract(hour from p_now at time zone coalesce(p.timezone, 'America/Sao_Paulo')) as hora
    from public.equipments e join public.profiles p on p.id = e.user_id
    where e.warranty_ends_on is not null
      and e.warranty_ends_on >= p_now::date - 1
      and e.warranty_ends_on <= p_now::date + 31
      and coalesce(e.warranty_warned, 99) > 7
  loop
    if r.hora < 9 then
      continue;
    end if;
    v_left := r.warranty_ends_on - r.today;
    v_step := case when v_left between 0 and 7 then 7 when v_left between 8 and 30 then 30 end;
    if v_step is null or v_step >= coalesce(r.warranty_warned, 99) then
      continue;
    end if;
    insert into public.notifications (user_id, kind, payload)
    values (r.user_id, 'automation', jsonb_build_object(
      'titulo', 'Garantia acabando',
      'message', case when v_left = 0 then 'A garantia de ' || r.name || ' acaba hoje'
                      else 'A garantia de ' || r.name || ' acaba em ' || v_left || case when v_left = 1 then ' dia' else ' dias' end end,
      'equipamento', r.id));
    update public.equipments set warranty_warned = v_step where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.send_warranty_alerts(timestamptz), public.equipments_warranty() from public, anon, authenticated;

select cron.schedule('questlist-garantias', '5 * * * *', $$select public.send_warranty_alerts()$$);

-- Correção do CS1: apagar o plano (ou o equipamento, em cascata) com a tarefa aberta falhava ("tuple
-- to be deleted was already modified"): o gatilho apagava a tarefa ANTES, e a chave estrangeira
-- `task_id ... on delete set null` tentava mexer no plano que estava sendo apagado. Agora a tarefa
-- sai DEPOIS do plano.
drop trigger maintenance_plans_delete on public.maintenance_plans;
create or replace function public.maintenance_plans_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.task_id is not null then
    delete from public.tasks where id = old.task_id and status <> 'done';
  end if;
  return null;
end;
$$;
create trigger maintenance_plans_delete after delete on public.maintenance_plans
  for each row execute function public.maintenance_plans_delete();
