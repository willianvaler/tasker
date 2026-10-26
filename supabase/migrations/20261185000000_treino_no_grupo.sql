-- V6 AC15B (D252, D279): treino ↔ grupo nos dois sentidos. Continua dando para criar o treino
-- dentro do grupo; agora também, num treino da Academia, "Adicionar a um grupo" (um ou vários).
-- O treino segue da pessoa (fica na Academia dela) e os membros do grupo o recebem ao vivo, pelo
-- mesmo mecanismo da página enviada (D133): leem por is_page_recipient, marcam com o próprio
-- diário e o "feito" de cada um. Os envios do grupo são reconciliados pelo servidor: entrou no
-- grupo, recebe; saiu, ou o treino saiu do grupo, perde.

create table public.page_group_links (
  page_id uuid not null references public.pages (id) on delete cascade,
  -- O grupo de treino: pasta raiz com gym_group
  folder_id uuid not null references public.folders (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (page_id, folder_id)
);
create index page_group_links_folder on public.page_group_links (folder_id);
alter table public.page_group_links enable row level security;
revoke insert, update, delete on public.page_group_links from anon, authenticated;
create policy "page_group_links_select" on public.page_group_links for select to authenticated
  using (public.is_folder_member(folder_id) or public.can_share_page(page_id));

-- O envio que nasceu do grupo (nulo: envio direto, D133)
alter table public.page_shares add column group_id uuid references public.folders (id) on delete set null;

-- Acerta os envios do grupo de uma página: cada membro dos grupos ligados recebe ao vivo (menos
-- quem já é da pasta do treino e quem já tem um envio direto); quem não está mais em nenhum perde
create function public._sync_group_shares(p_page_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid;
begin
  select public.folder_root(p.folder_id) into v_root from public.pages p where p.id = p_page_id;

  update public.page_shares s set status = 'revoked'
  where s.page_id = p_page_id and s.group_id is not null and s.status = 'active'
    and (v_root is null or not exists (
      select 1 from public.page_group_links l
      join public.folder_members m on m.folder_id = l.folder_id and m.user_id = s.recipient_id
      where l.page_id = p_page_id)
      or exists (select 1 from public.folder_members m where m.folder_id = v_root and m.user_id = s.recipient_id));

  -- O grupo de um envio que continua mas por outro grupo (o primeiro saiu)
  update public.page_shares s set group_id = (
      select l.folder_id from public.page_group_links l
      join public.folder_members m on m.folder_id = l.folder_id and m.user_id = s.recipient_id
      where l.page_id = p_page_id order by l.created_at, l.folder_id limit 1)
  where s.page_id = p_page_id and s.group_id is not null and s.status = 'active'
    and not exists (select 1 from public.page_group_links l
                    where l.page_id = p_page_id and l.folder_id = s.group_id);

  if v_root is null then
    return;
  end if;
  insert into public.page_shares (page_id, owner_id, recipient_id, mode, status, accepted_at, group_id)
  select distinct on (m.user_id) p_page_id, coalesce(l.added_by, m.user_id), m.user_id, 'live', 'active', now(), l.folder_id
  from public.page_group_links l
  join public.folder_members m on m.folder_id = l.folder_id
  where l.page_id = p_page_id
    and not exists (select 1 from public.folder_members o where o.folder_id = v_root and o.user_id = m.user_id)
    and not exists (select 1 from public.page_shares s
                    where s.page_id = p_page_id and s.recipient_id = m.user_id and s.status in ('pending', 'active'))
  order by m.user_id, l.created_at, l.folder_id;
end;
$$;

create function public.page_group_links_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._sync_group_shares(coalesce(new.page_id, old.page_id));
  return null;
end;
$$;
create trigger page_group_links_sync
  after insert or delete on public.page_group_links
  for each row execute function public.page_group_links_sync();

-- Entrou ou saiu do grupo: acerta os treinos ligados a ele
create function public.folder_members_group_shares()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_page uuid;
begin
  for v_page in select l.page_id from public.page_group_links l
                where l.folder_id = coalesce(new.folder_id, old.folder_id) loop
    perform public._sync_group_shares(v_page);
  end loop;
  return null;
end;
$$;
create trigger folder_members_group_shares
  after insert or delete on public.folder_members
  for each row execute function public.folder_members_group_shares();

-- Os grupos de treino em que posso pôr este treino, com os que já estão ligados
create function public.page_group_options(p_page_id uuid)
returns table (folder_id uuid, name text, icon text, linked boolean, members integer)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.name, f.icon,
         exists (select 1 from public.page_group_links l where l.page_id = p_page_id and l.folder_id = f.id),
         (select count(*)::integer from public.folder_members m where m.folder_id = f.id)
  from public.folders f
  join public.folder_members me on me.folder_id = f.id and me.user_id = auth.uid()
  where f.parent_id is null and f.gym_group
    and public.can_share_page(p_page_id)
    and f.id <> (select public.folder_root(p.folder_id) from public.pages p where p.id = p_page_id)
    and public.has_permission(f.id, 'task.create')
  order by f.name;
$$;

-- "Adicionar a um grupo": os grupos escolhidos passam a ser exatamente estes. Só o treino da
-- Academia de quem gerencia os envios dele, e só grupos em que a pessoa cria treinos
create function public.set_page_groups(p_page_id uuid, p_folder_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder uuid;
begin
  if not exists (
    select 1 from public.pages p join public.folders f on f.id = p.folder_id
    left join public.folders r on r.id = f.parent_id
    where p.id = p_page_id and (f.is_gym or coalesce(r.is_gym, false))
  ) or not public.can_share_page(p_page_id) then
    raise exception 'Só um treino da sua Academia vai para um grupo' using errcode = '42501';
  end if;
  foreach v_folder in array coalesce(p_folder_ids, '{}') loop
    if not exists (select 1 from public.page_group_options(p_page_id) o where o.folder_id = v_folder) then
      raise exception 'Grupo indisponível para este treino' using errcode = '22023';
    end if;
  end loop;

  delete from public.page_group_links
  where page_id = p_page_id and not (folder_id = any (coalesce(p_folder_ids, '{}')));
  insert into public.page_group_links (page_id, folder_id, added_by)
  select p_page_id, f, auth.uid() from unnest(coalesce(p_folder_ids, '{}')) f
  on conflict do nothing;
end;
$$;

-- Os treinos que membros puseram no grupo (a outra visão do mesmo vínculo)
create function public.group_linked_pages(p_folder_id uuid)
returns table (page_id uuid, name text, icon text, view_type text, owner_id uuid, owner_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.icon, p.view_type::text, l.added_by, pr.display_name
  from public.page_group_links l
  join public.pages p on p.id = l.page_id
  left join public.profiles pr on pr.id = l.added_by
  where l.folder_id = p_folder_id and public.is_folder_member(p_folder_id)
  order by p.name;
$$;

-- Tirar do grupo também pode quem gerencia o grupo (o treino continua de quem o criou)
create function public.unlink_page_group(p_page_id uuid, p_folder_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.can_share_page(p_page_id) or public.has_permission(p_folder_id, 'page.manage')) then
    raise exception 'Seu cargo não tira treinos deste grupo' using errcode = '42501';
  end if;
  delete from public.page_group_links where page_id = p_page_id and folder_id = p_folder_id;
end;
$$;

alter publication supabase_realtime add table public.page_group_links;

revoke execute on function public._sync_group_shares(uuid), public.page_group_links_sync(),
  public.folder_members_group_shares()
  from public, anon, authenticated;
revoke execute on function public.page_group_options(uuid), public.set_page_groups(uuid, uuid[]),
  public.group_linked_pages(uuid), public.unlink_page_group(uuid, uuid)
  from public, anon;
grant execute on function public.page_group_options(uuid), public.set_page_groups(uuid, uuid[]),
  public.group_linked_pages(uuid), public.unlink_page_group(uuid, uuid)
  to authenticated;
