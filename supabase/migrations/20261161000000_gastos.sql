-- ESCOPO_V9 (GA1): página de gastos e fluxo de caixa. Cada lançamento é uma linha de `expenses`
-- (saída ou entrada, em centavos inteiros), numa página do tipo novo `expenses`. A pasta vem da
-- página por trigger, como nas tarefas. Quem vê a pasta vê os gastos; lançar e editar pedem
-- `expense.write` (Colaborador: só os que lançou). A foto da nota fica no bucket privado
-- `receipts` ("<pasta>/<lançamento>/<arquivo>"). As leituras de foto (GA4) ficam registradas em
-- `photo_reads`, para o limite do mês.

alter type public.page_view_type add value if not exists 'expenses';

-- Orçamento da página de gastos (opcional)
alter table public.pages add column budget_cents bigint
  check (budget_cents is null or budget_cents between 1 and 100000000000);
grant insert (budget_cents), update (budget_cents) on public.pages to authenticated;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  spent_on date not null default current_date,
  description text not null check (char_length(trim(description)) between 1 and 200),
  category text check (category is null or char_length(category) between 1 and 60),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  kind text not null default 'out' check (kind in ('out', 'in')),
  paid_by uuid references public.profiles (id) on delete set null,
  method text check (method is null or char_length(method) between 1 and 40),
  task_id uuid references public.tasks (id) on delete set null,
  receipt_path text check (receipt_path is null or char_length(receipt_path) <= 300),
  -- Chave de acesso da NFC-e (44 dígitos): a mesma nota não entra duas vezes na página
  nfce_key text check (nfce_key is null or nfce_key ~ '^[0-9]{44}$'),
  -- Itens lidos da nota (GA5): [{description, amount_cents}]
  items jsonb check (items is null or jsonb_typeof(items) = 'array'),
  note text check (note is null or char_length(note) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_page on public.expenses (page_id, spent_on desc);
create index expenses_folder on public.expenses (folder_id);
create index expenses_creator on public.expenses (created_by);
create unique index expenses_nfce on public.expenses (page_id, nfce_key) where nfce_key is not null;

-- Pasta pela página; página de outro tipo, tarefa de outra pasta ou quem pagou de fora do projeto
-- são recusados
create function public.expenses_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type text;
begin
  select p.folder_id, p.view_type::text into new.folder_id, v_type
  from public.pages p where p.id = new.page_id;
  if v_type is distinct from 'expenses' then
    raise exception 'Gastos só numa página de gastos' using errcode = '22023';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and public.folder_root(t.folder_id) = public.folder_root(new.folder_id)
  ) then
    raise exception 'A tarefa ligada tem de ser do mesmo projeto' using errcode = '22023';
  end if;
  if new.paid_by is not null and not exists (
    select 1 from public.folder_members m
    where m.folder_id = public.folder_root(new.folder_id) and m.user_id = new.paid_by
  ) then
    raise exception 'Quem pagou tem de ser do projeto' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger expenses_fill before insert or update on public.expenses
  for each row execute function public.expenses_fill();

-- Permissão nova no catálogo (espelho em src/lib/permissions.ts; o teste compara)
create or replace function public.permission_presets()
returns jsonb
language sql immutable
as $fn$
  select $json${
  "presets": {
    "owner": ["project.view", "project.delete", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth", "expense.write"],
    "manager": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth", "expense.write"],
    "editor": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "expense.write"],
    "contributor": ["project.view", "comment.create", "task.create", "task.complete:own", "task.start:own", "task.delete:own", "item.check:own", "item.log:own", "timer.use:own", "expense.write:own"],
    "viewer": ["project.view", "comment.create"],
    "executor": ["project.view", "comment.create", "item.check", "item.log", "timer.use"]
  },
  "own": {"task.complete": "assigned", "task.start": "assigned", "item.check": "assigned", "item.log": "assigned", "timer.use": "assigned", "task.delete": "created", "expense.write": "created"}
}$json$::jsonb;
$fn$;

create function public.can_see_expense(p_expense_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id and public.is_folder_member(e.folder_id)
  );
$$;

create function public.can_edit_expense(p_expense_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and public.has_permission(e.folder_id, 'expense.write', false,
                                e.created_by = (select auth.uid()))
  );
$$;
grant execute on function public.can_see_expense(uuid), public.can_edit_expense(uuid) to authenticated;

alter table public.expenses enable row level security;
create policy "expenses_select" on public.expenses for select to authenticated
  using (public.is_folder_member(folder_id));
-- A pasta já veio da página (trigger antes da checagem)
create policy "expenses_insert" on public.expenses for insert to authenticated
  with check (created_by = (select auth.uid())
              and public.has_permission(folder_id, 'expense.write', false, true));
create policy "expenses_update" on public.expenses for update to authenticated
  using (public.has_permission(folder_id, 'expense.write', false, created_by = (select auth.uid())))
  with check (public.has_permission(folder_id, 'expense.write', false, created_by = (select auth.uid())));
create policy "expenses_delete" on public.expenses for delete to authenticated
  using (public.has_permission(folder_id, 'expense.write', false, created_by = (select auth.uid())));
revoke insert, update on public.expenses from anon, authenticated;
grant insert (id, page_id, spent_on, description, category, amount_cents, currency, kind, paid_by,
              method, task_id, receipt_path, nfce_key, items, note),
      update (spent_on, description, category, amount_cents, currency, kind, paid_by, method,
              task_id, receipt_path, nfce_key, items, note)
  on public.expenses to authenticated;
alter publication powersync add table public.expenses;
alter publication supabase_realtime add table public.expenses;

-- Fotos das notas: a segunda parte do caminho é o lançamento
insert into storage.buckets (id, name, public, file_size_limit)
values ('receipts', 'receipts', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
create policy "receipts: ler" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.can_see_expense((storage.foldername(name))[2]::uuid));
create policy "receipts: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_edit_expense((storage.foldername(name))[2]::uuid));
create policy "receipts: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_edit_expense((storage.foldername(name))[2]::uuid));

-- GA4: cada leitura de foto (nota ou lista), para o limite do mês. Só o servidor grava.
create table public.photo_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('receipt', 'list')),
  provider text not null check (char_length(provider) <= 40),
  model text check (model is null or char_length(model) <= 80),
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index photo_reads_user on public.photo_reads (user_id, created_at desc);
alter table public.photo_reads enable row level security;
create policy "photo_reads: as minhas" on public.photo_reads for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.photo_reads from anon, authenticated;

-- Leituras por mês (V9-3, provisório: 100); falha não conta
create function public.photo_read_limit()
returns integer
language sql immutable set search_path = ''
as $$ select 100 $$;

create function public.photo_reads_left()
returns integer
language sql stable security definer set search_path = ''
as $$
  select greatest(0, public.photo_read_limit() - (
    select count(*)::integer from public.photo_reads r
    where r.user_id = auth.uid() and r.ok
      and r.created_at >= date_trunc('month', now())
  ));
$$;
grant execute on function public.photo_read_limit(), public.photo_reads_left() to authenticated;

-- Exportar meus dados (LGPD): os lançamentos que fiz e as leituras de foto
create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;
