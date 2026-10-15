-- V3 §6 (M5): campos personalizados por página (Notion-lite). A página define os campos; cada
-- tarefa guarda os valores em `tasks.custom` ({id do campo: valor}). Definir pede page.manage;
-- preencher, editar a tarefa (os guardas de sempre).
create table public.page_fields (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('text', 'number', 'select', 'date', 'person', 'money')),
  -- Seleção: as opções (até 20)
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 20),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index page_fields_page on public.page_fields (page_id);

create function public.page_fields_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select folder_id into new.folder_id from public.pages where id = new.page_id;
  if tg_op = 'INSERT' and (select count(*) from public.page_fields where page_id = new.page_id) >= 10 then
    raise exception 'No máximo 10 campos por página' using errcode = '22023';
  end if;
  new.name := trim(new.name);
  return new;
end;
$$;
create trigger page_fields_fill before insert or update on public.page_fields
  for each row execute function public.page_fields_fill();

alter table public.page_fields enable row level security;
create policy "page_fields_select" on public.page_fields for select to authenticated
  using (public.is_folder_member(folder_id) or public.is_page_recipient(page_id));
create policy "page_fields_write" on public.page_fields for all to authenticated
  using (public.has_permission(folder_id, 'page.manage'))
  with check (public.has_permission((select p.folder_id from public.pages p where p.id = page_id), 'page.manage'));
revoke insert, update on public.page_fields from anon, authenticated;
grant insert (id, page_id, name, kind, options, position), update (name, options, position)
  on public.page_fields to authenticated;
alter publication powersync add table public.page_fields;

alter table public.tasks add column custom jsonb not null default '{}'
  check (jsonb_typeof(custom) = 'object' and pg_column_size(custom) < 8000);
grant insert (custom), update (custom) on public.tasks to authenticated;
