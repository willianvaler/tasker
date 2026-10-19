-- ESCOPO_V9 (GA1): lançamento de gasto apagado vai para a lixeira (sozinho ou junto com a página),
-- com a descrição como título.
alter table public.deleted_items drop constraint deleted_items_kind_check;
alter table public.deleted_items add constraint deleted_items_kind_check check (kind in (
  'folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments', 'task_attachments',
  'expenses'));

create or replace function public._trash_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := to_jsonb(old);
  v_root uuid;
  v_title text;
  v_row_id text;
begin
  -- Exclusão de conta não guarda nada (a pessoa pediu para apagar)
  if current_setting('questlist.skip_trash', true) = 'on' then
    return old;
  end if;

  if tg_table_name = 'folder_members' then
    -- Só junto com a pasta; tirar alguém do projeto não é coisa de lixeira
    if not exists (select 1 from public.deleted_items d
                   where d.batch = txid_current() and d.kind = 'folders'
                     and d.row_id = v_payload ->> 'folder_id') then
      return old;
    end if;
    v_row_id := (v_payload ->> 'folder_id') || ':' || (v_payload ->> 'user_id');
  else
    v_row_id := v_payload ->> 'id';
  end if;

  v_title := coalesce(v_payload ->> 'name', v_payload ->> 'title', left(v_payload ->> 'body', 80),
                     v_payload ->> 'description');
  -- Pelo payload: `old.parent_id` não existe nas outras tabelas e o plpgsql reclama
  v_root := case tg_table_name
    when 'folders' then (v_payload ->> 'parent_id')::uuid
    else public.folder_root((v_payload ->> 'folder_id')::uuid)
  end;
  -- Em cascata, a pasta já saiu: a raiz é a do primeiro item da mesma exclusão
  if v_root is null and tg_table_name <> 'folders' then
    select coalesce(d.root_folder_id, (d.payload ->> 'id')::uuid) into v_root
    from public.deleted_items d where d.batch = txid_current() order by d.deleted_at, d.id limit 1;
  end if;

  insert into public.deleted_items (kind, row_id, root_folder_id, title, payload)
  values (tg_table_name, v_row_id, v_root, v_title, v_payload);
  return old;
end;
$$;

create trigger expenses_trash before delete on public.expenses
  for each row execute function public._trash_row();
