-- N4: limites dos anexos e limpeza do disco (D153).
-- 1. A cota (1 GB, provisório) conta pelo dono do anexo, não por quem está rodando (restaurar da
--    lixeira roda como quem restaura).
-- 2. Anexo apagado junto com a tarefa vai para a lixeira (volta ao restaurar) e o arquivo fica
--    no Storage até a lixeira vencer (30 dias). Anexo removido de propósito, ou que saiu da
--    lixeira, entra em `storage_garbage`; um cron apaga o arquivo pela API do Storage (pg_net),
--    se `app_config` tiver `storage_url` e `storage_key` (veja docs/OPERACOES.md).

create or replace function public.task_attachments_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select folder_id into new.folder_id from public.tasks where id = new.task_id;
  if split_part(new.path, '/', 2) <> new.task_id::text
     or (new.thumb_path is not null and split_part(new.thumb_path, '/', 2) <> new.task_id::text) then
    raise exception 'Caminho do anexo não é o da tarefa' using errcode = '22023';
  end if;
  if coalesce((select sum(size) from public.task_attachments
               where created_by = coalesce(new.created_by, auth.uid()) and id <> new.id), 0) + new.size
     > 1073741824 then
    raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Quanto a pessoa usa (Perfil e aviso antes de enviar)
create function public.attachment_usage()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(size), 0)::bigint from public.task_attachments where created_by = (select auth.uid());
$$;
grant execute on function public.attachment_usage() to authenticated;

create table public.storage_garbage (
  path text primary key,
  queued_at timestamptz not null default now()
);
alter table public.storage_garbage enable row level security;
revoke all on public.storage_garbage from anon, authenticated;

-- Lixeira: anexos só junto com a tarefa (remover um anexo não é coisa de lixeira)
alter table public.deleted_items drop constraint deleted_items_kind_check;
alter table public.deleted_items add constraint deleted_items_kind_check check (kind in (
  'folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments', 'task_attachments'));

create function public.task_attachments_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('questlist.skip_trash', true) is distinct from 'on'
     and exists (select 1 from public.deleted_items d
                 where d.batch = txid_current() and d.kind = 'tasks' and d.row_id = old.task_id::text) then
    insert into public.deleted_items (kind, row_id, root_folder_id, title, payload)
    values ('task_attachments', old.id::text, public.folder_root(old.folder_id), old.name, to_jsonb(old));
  else
    insert into public.storage_garbage (path)
    select p from unnest(array[old.path, old.thumb_path]) p where p is not null
    on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger task_attachments_deleted before delete on public.task_attachments
  for each row execute function public.task_attachments_deleted();

-- A lixeira vence: os arquivos dos anexos dela vão para a fila de apagar
create function public.purge_trash()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.storage_garbage (path)
  select p from public.deleted_items d,
    unnest(array[d.payload ->> 'path', d.payload ->> 'thumb_path']) p
  where d.kind = 'task_attachments' and d.deleted_at < now() - interval '30 days' and p is not null
  on conflict do nothing;
  delete from public.deleted_items where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
select cron.unschedule('questlist-trash');
select cron.schedule('questlist-trash', '23 3 * * *', $$select public.purge_trash()$$);

-- Apaga os arquivos da fila, até 100 por vez (Storage: DELETE /object/<bucket> {prefixes})
create function public.flush_storage_garbage()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'storage_url');
  v_key text := (select value from public.app_config where key = 'storage_key');
  v_paths text[];
begin
  if v_url is null or v_key is null then
    return 0;
  end if;
  select array_agg(path) into v_paths
  from (select path from public.storage_garbage order by queued_at limit 100) g;
  if v_paths is null then
    return 0;
  end if;
  perform net.http_delete(
    url := v_url || '/object/attachments',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key,
                                  'Content-Type', 'application/json'),
    body := jsonb_build_object('prefixes', to_jsonb(v_paths)));
  delete from public.storage_garbage where path = any (v_paths);
  return coalesce(array_length(v_paths, 1), 0);
end;
$$;
select cron.schedule('questlist-storage-garbage', '*/10 * * * *', $$select public.flush_storage_garbage()$$);

revoke execute on function public.purge_trash(), public.flush_storage_garbage() from public, anon, authenticated;
