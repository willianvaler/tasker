-- D7: lixeira. Apagar continua sendo DELETE de verdade (o sync e todas as consultas do servidor
-- seguem iguais), mas antes a linha é copiada para deleted_items. Tudo o que sai numa exclusão
-- (a pasta, as páginas, as tarefas, os comentários) fica no mesmo `batch` e volta junto.
-- Fica 30 dias.

create table public.deleted_items (
  id uuid primary key default gen_random_uuid(),
  batch bigint not null default txid_current(),
  kind text not null check (kind in ('folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments')),
  row_id text not null,
  -- Pasta raiz de onde saiu (quem é membro dela vê e restaura); nula numa pasta raiz apagada
  root_folder_id uuid,
  title text,
  payload jsonb not null,
  deleted_by uuid default auth.uid(),
  deleted_at timestamptz not null default now()
);
create index deleted_items_batch on public.deleted_items (batch);
create index deleted_items_root on public.deleted_items (root_folder_id);
create index deleted_items_by on public.deleted_items (deleted_by, deleted_at desc);
alter table public.deleted_items enable row level security;
revoke all on public.deleted_items from anon, authenticated;
grant select on public.deleted_items to authenticated;

create policy "Quem apagou ou é editor da pasta vê" on public.deleted_items
  for select to authenticated
  using (deleted_by = (select auth.uid()) or public.is_folder_member(root_folder_id, 'editor'));

create function public._trash_row()
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

  v_title := coalesce(v_payload ->> 'name', v_payload ->> 'title', left(v_payload ->> 'body', 80));
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

create trigger folders_trash before delete on public.folders
  for each row execute function public._trash_row();
create trigger folder_members_trash before delete on public.folder_members
  for each row execute function public._trash_row();
create trigger pages_trash before delete on public.pages
  for each row execute function public._trash_row();
create trigger tasks_trash before delete on public.tasks
  for each row execute function public._trash_row();
create trigger task_assignees_trash before delete on public.task_assignees
  for each row execute function public._trash_row();
create trigger comments_trash before delete on public.comments
  for each row execute function public._trash_row();

-- O que está na lixeira, uma linha por exclusão (o item principal de cada batch)
create function public.trash_list()
returns table (id uuid, kind text, title text, deleted_at timestamptz, items integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (d.batch) d.id, d.kind, d.title, d.deleted_at,
         (count(*) over (partition by d.batch))::integer
  from public.deleted_items d
  where d.kind <> 'folder_members'
  order by d.batch, d.deleted_at, d.id;
$$;

create function public.restore_deleted(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.deleted_items;
  v_row public.deleted_items;
  v_count integer := 0;
begin
  select * into v_item from public.deleted_items where id = p_id;
  if v_item.id is null
     or not (v_item.deleted_by = auth.uid() or public.is_folder_member(v_item.root_folder_id, 'editor')) then
    raise exception 'Item não encontrado na lixeira' using errcode = 'P0002';
  end if;

  for v_row in
    select * from public.deleted_items where batch = v_item.batch
    order by case kind when 'folders' then 0 when 'folder_members' then 1 when 'pages' then 2
                       when 'tasks' then 3 else 4 end,
             (payload ->> 'parent_id') is not null,
             (payload ->> 'parent_task_id') is not null,
             deleted_at
  loop
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
      v_row.kind, v_row.kind)
    using v_row.payload;
    v_count := v_count + 1;
  end loop;
  delete from public.deleted_items where batch = v_item.batch;
  return v_count;
end;
$$;

revoke execute on function public.restore_deleted(uuid) from public, anon;
grant execute on function public.restore_deleted(uuid) to authenticated;
grant execute on function public.trash_list() to authenticated;

select cron.schedule('questlist-trash', '23 3 * * *',
  $$delete from public.deleted_items where deleted_at < now() - interval '30 days'$$);

-- Exclusão de conta: sem lixeira (é pedido de apagar de vez)
CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_folder record;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  for v_folder in
    select f.id, (select m.user_id from public.folder_members m
                  where m.folder_id = f.id and m.user_id <> v_user
                  order by case m.role when 'editor' then 0 else 1 end, m.joined_at limit 1) as heir
    from public.folders f where f.owner_id = v_user and f.parent_id is null and not f.is_inbox
  loop
    if v_folder.heir is not null then
      update public.folders set owner_id = v_folder.heir where id = v_folder.id or parent_id = v_folder.id;
      update public.folder_members set role = 'owner' where folder_id = v_folder.id and user_id = v_folder.heir;
    end if;
  end loop;
  -- O que a pessoa criou ou recebeu em projetos dos outros fica com o projeto
  update public.tasks t set created_by = f.owner_id
  from public.folders f
  where f.id = public.folder_root(t.folder_id) and t.created_by = v_user and f.owner_id <> v_user;
  delete from public.task_assignees a
  where a.user_id = v_user and exists (
    select 1 from public.task_assignees b, public.profiles p
    where p.id = v_user and b.task_id = a.task_id and lower(b.pending_name) = lower(p.display_name));
  update public.task_assignees
  set user_id = null,
      pending_name = (select left(coalesce(nullif(trim(display_name), ''), 'Alguém'), 50)
                      from public.profiles where id = v_user)
  where user_id = v_user;

  if exists (select 1 from public.clan_members where user_id = v_user) then
    perform public.leave_clan();
  end if;
  -- Nada do que sai daqui vai para a lixeira, e o que a pessoa já tinha apagado também some
  perform set_config('questlist.skip_trash', 'on', true);
  delete from public.deleted_items where deleted_by = v_user;
  delete from auth.users where id = v_user;
end;
$function$;
