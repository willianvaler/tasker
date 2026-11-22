-- Imagens nas anotações (ES3, ESCOPO_V13 §2, D324). O que o D291 deixou de fora: a anotação ganha
-- arquivos próprios. Ficam no mesmo bucket privado dos anexos (`attachments`), no caminho
-- "notes/<anotação>/<id>.<ext>", para reaproveitar a fila de limpeza (storage_garbage) e a cota de
-- 1 GB por conta. Quem lê a anotação vê a imagem; quem pode mudar a anotação envia e remove (o mesmo
-- critério das policies de `notes`: a dona, o projeto, o compartilhamento do OB14). A anotação
-- aponta para a imagem com `![texto](qlimg:<anotação>/<id>.<ext>)`, que já é o caminho (mostrar não
-- consulta a tabela; ela serve à cota, à permissão e à lixeira).

create table public.note_assets (
  id uuid primary key,
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  path text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (mime like 'image/%' and char_length(mime) <= 100),
  size integer not null check (size between 1 and 10485760),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index note_assets_note on public.note_assets (note_id);
create index note_assets_user on public.note_assets (user_id);

-- Ler a anotação: a policy de select de `notes` decide (a função roda como quem pede)
create function public.can_see_note(p_note uuid)
returns boolean
language sql stable set search_path = ''
as $$ select exists (select 1 from public.notes where id = p_note) $$;

-- Mudar a anotação: o mesmo critério da policy de update de `notes`
create function public.can_edit_note(p_note uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note
      and ((n.folder_id is null and (n.user_id = (select auth.uid()) or public._note_shared(n.id, true)))
           or (n.folder_id is not null
               and public.has_permission(n.folder_id, 'task.edit', false, n.user_id = (select auth.uid())))))
$$;

alter table public.note_assets enable row level security;
revoke all on public.note_assets from anon;
revoke insert, update on public.note_assets from authenticated;
grant insert (id, note_id, path, name, mime, size, width, height) on public.note_assets to authenticated;
create policy "note_assets_select" on public.note_assets for select to authenticated
  using (public.can_see_note(note_id));
create policy "note_assets_insert" on public.note_assets for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_edit_note(note_id));
create policy "note_assets_delete" on public.note_assets for delete to authenticated
  using (public.can_edit_note(note_id));

-- Espaço usado: anexos das tarefas + versões das anotações + imagens das anotações (1 GB por conta)
create or replace function public._storage_used(p_user uuid, p_skip_attachment uuid default null)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(size) from public.task_attachments
                   where created_by = p_user and id is distinct from p_skip_attachment), 0)::bigint
       + coalesce((select sum(size) from public.note_versions where user_id = p_user), 0)::bigint
       + coalesce((select sum(size) from public.note_assets
                   where user_id = p_user and id is distinct from p_skip_attachment), 0)::bigint;
$$;

create function public.note_assets_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.path !~ ('^notes/' || new.note_id::text || '/[0-9a-f-]{36}\.[a-z0-9]{1,8}$') then
    raise exception 'Caminho da imagem não é o da anotação' using errcode = '22023';
  end if;
  if public._storage_used(new.user_id, new.id) + new.size > 1073741824 then
    raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger note_assets_fill before insert on public.note_assets
  for each row execute function public.note_assets_fill();

-- Apagar: junto com a anotação que vai para a lixeira, a imagem vai também (e volta com ela); fora
-- disso, o arquivo entra na fila de apagar do Storage
alter table public.deleted_items drop constraint deleted_items_kind_check;
alter table public.deleted_items add constraint deleted_items_kind_check check (kind in (
  'folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments', 'task_attachments',
  'expenses', 'notes', 'note_versions', 'note_assets'));

create function public.note_assets_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('questlist.skip_trash', true) is distinct from 'on'
     and exists (select 1 from public.deleted_items d
                 where d.batch = txid_current() and d.kind = 'notes' and d.row_id = old.note_id::text) then
    insert into public.deleted_items (kind, row_id, root_folder_id, title, payload)
    select 'note_assets', old.id::text, d.root_folder_id, old.name, to_jsonb(old)
    from public.deleted_items d
    where d.batch = txid_current() and d.kind = 'notes' and d.row_id = old.note_id::text
    limit 1;
  else
    insert into public.storage_garbage (path) values (old.path) on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger note_assets_deleted before delete on public.note_assets
  for each row execute function public.note_assets_deleted();

-- A lixeira vence: os arquivos dos anexos e das imagens dela vão para a fila de apagar
create or replace function public.purge_trash()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.storage_garbage (path)
  select p from public.deleted_items d,
    unnest(array[d.payload ->> 'path', d.payload ->> 'thumb_path']) p
  where d.kind in ('task_attachments', 'note_assets') and d.deleted_at < now() - interval '30 days'
    and p is not null
  on conflict do nothing;
  delete from public.deleted_items where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Storage: as imagens das anotações no bucket dos anexos (as policies das tarefas olham o segundo
-- nível do caminho como tarefa e não deixam passar: estas somam)
create policy "note assets: ler" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = 'notes'
         and public.can_see_note((storage.foldername(name))[2]::uuid));
create policy "note assets: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = 'notes'
              and public.can_edit_note((storage.foldername(name))[2]::uuid));
create policy "note assets: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = 'notes'
         and public.can_edit_note((storage.foldername(name))[2]::uuid));

revoke execute on function public.note_assets_fill(), public.note_assets_deleted() from public, anon, authenticated;
revoke execute on function public.can_see_note(uuid), public.can_edit_note(uuid) from public, anon;
grant execute on function public.can_see_note(uuid), public.can_edit_note(uuid) to authenticated;
