-- V2 §5 (E6): marcos, as datas-chave de um projeto ("Compras até sexta", "Churrasco no sábado").
-- Só em projeto (pasta raiz kind = 'project'). Vão para o aparelho pelo sync, como páginas e
-- tarefas; criar, mudar e concluir pedem page.manage.

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  due_date date,
  done_at timestamptz,
  position double precision not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  version integer not null default 1
);
create index milestones_folder_idx on public.milestones (folder_id, due_date);

create function public.milestones_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.folders where id = new.folder_id and kind = 'project' and parent_id is null) then
    raise exception 'Marcos só existem em projetos' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger milestones_before_write
  before insert or update of folder_id on public.milestones
  for each row execute function public.milestones_before_write();

create trigger milestones_sync_touch before update on public.milestones
  for each row execute function public._sync_touch();

alter table public.milestones enable row level security;

create policy "milestones_select" on public.milestones for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "milestones_insert" on public.milestones for insert to authenticated
  with check (public.has_permission(folder_id, 'page.manage') and created_by = (select auth.uid()));
create policy "milestones_update" on public.milestones for update to authenticated
  using (public.has_permission(folder_id, 'page.manage'))
  with check (public.has_permission(folder_id, 'page.manage'));
create policy "milestones_delete" on public.milestones for delete to authenticated
  using (public.has_permission(folder_id, 'page.manage'));

revoke all on public.milestones from anon, authenticated;
grant select, delete on public.milestones to authenticated;
grant insert (id, folder_id, name, due_date, done_at, position) on public.milestones to authenticated;
grant update (name, due_date, done_at, position) on public.milestones to authenticated;

alter publication powersync add table public.milestones;
alter publication supabase_realtime add table public.milestones;
