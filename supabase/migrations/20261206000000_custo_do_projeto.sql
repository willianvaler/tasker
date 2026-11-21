-- GP4 (D316, ESCOPO_V12 §6): valor da hora e orçamento do projeto. Quem gerencia (member.manage)
-- define o valor da hora de cada pessoa e um padrão do projeto; tempo registrado (time_entries) ×
-- valor = custo do trabalho; somado aos gastos (D218) dá o orçamento, previsto × realizado. O valor
-- de cada pessoa só é visto por quem gerencia e por ela mesma (V12-5); os outros veem os totais.

create table public.project_rates (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  -- null = o valor padrão do projeto (vale para quem não tem um próprio)
  user_id uuid references public.profiles (id) on delete cascade,
  cents_per_hour integer not null check (cents_per_hour between 0 and 10000000),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create unique index project_rates_one on public.project_rates (folder_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'));

alter table public.project_rates enable row level security;
revoke all on public.project_rates from anon;
revoke insert, update on public.project_rates from authenticated;
grant insert (id, folder_id, user_id, cents_per_hour, currency), update (cents_per_hour, currency)
  on public.project_rates to authenticated;
create policy "project_rates_select" on public.project_rates for select to authenticated
  using (public.has_permission(folder_id, 'member.manage') or user_id = (select auth.uid()));
create policy "project_rates_insert" on public.project_rates for insert to authenticated
  with check (public.has_permission(folder_id, 'member.manage')
              and (select parent_id from public.folders where id = folder_id) is null);
create policy "project_rates_update" on public.project_rates for update to authenticated
  using (public.has_permission(folder_id, 'member.manage'))
  with check (public.has_permission(folder_id, 'member.manage'));
create policy "project_rates_delete" on public.project_rates for delete to authenticated
  using (public.has_permission(folder_id, 'member.manage'));

create function public.project_rates_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger project_rates_touch before update on public.project_rates
  for each row execute function public.project_rates_touch();

-- Orçamento do projeto: só para quem é do projeto. Trabalho previsto = estimativa das tarefas ×
-- valor de quem cuida (a primeira pessoa responsável, ou o padrão); realizado = minutos registrados
-- × valor de quem registrou. Gastos: previsto = orçamento das listas de gastos; realizado = saídas.
-- Gasto em outra moeda fica fora da soma (contado em other_currency). Por pessoa, o valor em
-- dinheiro só vai para quem gerencia e para a própria pessoa; os outros recebem só os minutos.
create function public.project_budget(p_root uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_manager boolean;
  v_currency text;
  v_default integer;
begin
  if v_me is null or not public.is_folder_member(p_root) then
    raise exception 'Projeto não encontrado' using errcode = 'P0002';
  end if;
  v_manager := public.has_permission(p_root, 'member.manage');
  select cents_per_hour, currency into v_default, v_currency
  from public.project_rates where folder_id = p_root and user_id is null;
  v_currency := coalesce(v_currency, 'BRL');
  v_default := coalesce(v_default, 0);

  return (
    with folders as (
      select f.id from public.folders f where f.id = p_root or f.parent_id = p_root
    ),
    rate as (
      select m.user_id, coalesce(r.cents_per_hour, v_default) as cents
      from public.folder_members m
      left join public.project_rates r on r.folder_id = p_root and r.user_id = m.user_id
      where m.folder_id = p_root
    ),
    tasks as (
      select t.id, t.page_id, coalesce(t.estimate_minutes, 0) as estimate,
             (select a.user_id from public.task_assignees a where a.task_id = t.id and a.user_id is not null
              order by a.id limit 1) as owner
      from public.tasks t join public.pages p on p.id = t.page_id
      where t.folder_id in (select id from folders) and p.view_type::text not in ('meeting', 'expenses')
    ),
    planned as (
      select t.page_id, sum(t.estimate * coalesce(r.cents, v_default) / 60.0) as cents
      from tasks t left join rate r on r.user_id = t.owner
      group by t.page_id
    ),
    worked as (
      select coalesce(t.page_id, null) as page_id, e.user_id, sum(e.minutes) as minutes,
             sum(e.minutes * coalesce(r.cents, v_default) / 60.0) as cents
      from public.time_entries e
      left join public.tasks t on t.id = e.task_id
      left join rate r on r.user_id = e.user_id
      where e.folder_id in (select id from folders)
      group by t.page_id, e.user_id
    ),
    spent as (
      select x.page_id, sum(x.amount_cents) filter (where x.currency = v_currency) as cents,
             count(*) filter (where x.currency <> v_currency) as other
      from public.expenses x
      where x.folder_id in (select id from folders) and x.kind = 'out'
      group by x.page_id
    ),
    pages as (
      select p.id, p.name, p.view_type::text as view_type, p.budget_cents
      from public.pages p where p.folder_id in (select id from folders) and p.view_type::text <> 'meeting'
    ),
    by_page as (
      select p.id, p.name, p.view_type,
             round(coalesce((select cents from planned where planned.page_id = p.id), 0))::bigint as work_planned,
             round(coalesce((select sum(cents) from worked where worked.page_id = p.id), 0))::bigint as work_actual,
             case when p.view_type = 'expenses' then coalesce(p.budget_cents, 0) else 0 end as expenses_planned,
             coalesce((select cents from spent where spent.page_id = p.id), 0)::bigint as expenses_actual
      from pages p
    )
    select jsonb_build_object(
      'currency', v_currency,
      'manager', v_manager,
      'default_rate', case when v_manager then v_default end,
      'work_planned', coalesce((select sum(work_planned) from by_page), 0),
      'work_actual', round(coalesce((select sum(cents) from worked), 0))::bigint,
      'expenses_planned', coalesce((select sum(expenses_planned) from by_page), 0),
      'expenses_actual', coalesce((select sum(cents) from spent), 0),
      'other_currency', coalesce((select sum(other) from spent), 0),
      'pages', coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from by_page b
                         where b.work_planned + b.work_actual + b.expenses_planned + b.expenses_actual > 0), '[]'),
      'people', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', w.user_id,
                 'name', (select display_name from public.profiles where id = w.user_id),
                 'minutes', w.minutes,
                 'cents', case when v_manager or w.user_id = v_me then round(w.cents)::bigint end)
               order by w.minutes desc)
        from (select user_id, sum(minutes) as minutes, sum(cents) as cents from worked group by user_id) w), '[]')
    )
  );
end;
$$;
revoke execute on function public.project_budget(uuid) from public, anon;
grant execute on function public.project_budget(uuid) to authenticated;

alter publication supabase_realtime add table public.project_rates;
