-- V4 §4 (N1): anexos de tarefa. O arquivo fica no Storage (bucket privado `attachments`, caminho
-- "<pasta>/<tarefa>/<id>.<ext>"); a tabela guarda os dados para listar (e vai para o aparelho
-- pelo sync). Quem vê a tarefa vê o anexo (inclusive quem recebeu a página ao vivo); quem edita a
-- tarefa anexa e remove. Limites (provisório, V4-4): 10 MB por arquivo, 1 GB por conta.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create table public.task_attachments (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  path text not null unique,
  thumb_path text,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (char_length(mime) <= 100),
  size integer not null check (size between 1 and 10485760),
  width integer,
  height integer,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_attachments_task on public.task_attachments (task_id);
create index task_attachments_folder on public.task_attachments (folder_id);
create index task_attachments_owner on public.task_attachments (created_by);

-- Pode ver / editar a tarefa? (o mesmo critério das policies e guardas da tarefa)
create function public.can_see_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (public.is_folder_member(t.folder_id) or public.is_page_recipient(t.page_id))
  );
$$;

create function public.can_edit_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and public.has_permission(t.folder_id, 'task.edit',
                                public.is_task_assignee(t.id, (select auth.uid())),
                                t.created_by = (select auth.uid()))
  );
$$;
grant execute on function public.can_see_task(uuid), public.can_edit_task(uuid) to authenticated;

create function public.task_attachments_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select folder_id into new.folder_id from public.tasks where id = new.task_id;
  -- O caminho tem de ser o da tarefa ("<pasta>/<tarefa>/..."), para a RLS do Storage valer
  if split_part(new.path, '/', 2) <> new.task_id::text
     or (new.thumb_path is not null and split_part(new.thumb_path, '/', 2) <> new.task_id::text) then
    raise exception 'Caminho do anexo não é o da tarefa' using errcode = '22023';
  end if;
  if coalesce((select sum(size) from public.task_attachments where created_by = auth.uid()), 0) + new.size
     > 1073741824 then
    raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger task_attachments_fill before insert on public.task_attachments
  for each row execute function public.task_attachments_fill();

alter table public.task_attachments enable row level security;
create policy "task_attachments_select" on public.task_attachments for select to authenticated
  using (public.can_see_task(task_id));
create policy "task_attachments_insert" on public.task_attachments for insert to authenticated
  with check (public.can_edit_task(task_id) and created_by = (select auth.uid()));
create policy "task_attachments_delete" on public.task_attachments for delete to authenticated
  using (public.can_edit_task(task_id));
revoke insert, update on public.task_attachments from anon, authenticated;
grant insert (id, task_id, path, thumb_path, name, mime, size, width, height) on public.task_attachments to authenticated;
alter publication powersync add table public.task_attachments;

-- Arquivos no Storage: a segunda parte do caminho é a tarefa
create policy "attachments: ler" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_see_task((storage.foldername(name))[2]::uuid));
create policy "attachments: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_edit_task((storage.foldername(name))[2]::uuid));
create policy "attachments: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.can_edit_task((storage.foldername(name))[2]::uuid));
