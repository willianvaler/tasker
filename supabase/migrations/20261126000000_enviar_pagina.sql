-- V3 §3.2 (L3): "Enviar para…". Por link (cada pessoa que aceita vira um envio) ou por e-mail
-- (convite pendente; quem ainda não tem conta vê ao entrar com aquele e-mail). Ao vivo, quem recebe
-- passa a ver a página (Executor); em cópia, a página e as tarefas são copiadas para uma pasta dela
-- ("Recebidas"). Quem entra por um envio não passa pela introdução (como no convite de projeto).

-- Cópia da página (com a árvore de tarefas, todas abertas) numa pasta do usuário
create function public._copy_page_for_me(p_page_id uuid, p_folder_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_folder uuid;
  v_new uuid := gen_random_uuid();
  v_level integer;
begin
  select * into v_page from public.pages where id = p_page_id;
  select id into v_folder from public.folders
  where owner_id = auth.uid() and parent_id is null and not is_inbox and kind = 'folder'
    and name = coalesce(nullif(trim(p_folder_name), ''), 'Recebidas')
  limit 1;
  if v_folder is null then
    insert into public.folders (name, kind) values (coalesce(nullif(trim(p_folder_name), ''), 'Recebidas'), 'folder')
    returning id into v_folder;
  end if;

  insert into public.pages (id, folder_id, name, icon, view_type, reset_cycle, position)
  values (v_new, v_folder, v_page.name, v_page.icon, v_page.view_type, v_page.reset_cycle,
          coalesce((select max(position) + 1 from public.pages where folder_id = v_folder), 0));

  drop table if exists _copy_map;
  create temp table _copy_map on commit drop as
    select t.id as old_id, gen_random_uuid() as new_id from public.tasks t where t.page_id = p_page_id;
  for v_level in 1 .. (public.tree_limits() ->> 'hard_max_depth')::int loop
    insert into public.tasks (id, page_id, parent_task_id, title, notes, priority, labels, recurrence,
                              position, meta, habit_kind, habit_target, created_by, repeat_plan, estimate_minutes)
    select m.new_id, v_new, pm.new_id, t.title, t.notes, t.priority, t.labels, t.recurrence,
           t.position, t.meta, t.habit_kind, t.habit_target, auth.uid(), t.repeat_plan, t.estimate_minutes
    from public.tasks t
    join _copy_map m on m.old_id = t.id
    left join _copy_map pm on pm.old_id = t.parent_task_id
    where t.page_id = p_page_id and t.depth = v_level;
  end loop;
  return v_new;
end;
$$;
revoke execute on function public._copy_page_for_me(uuid, text) from public, anon, authenticated;

-- Ativa um envio para quem está logado: ao vivo, passa a ver; cópia, ganha a página
create function public._activate_share(p_share_id uuid, p_folder_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_share public.page_shares;
  v_copy uuid;
begin
  select * into v_share from public.page_shares where id = p_share_id for update;
  if v_share.mode = 'copy' then
    v_copy := coalesce(v_share.copy_page_id, public._copy_page_for_me(v_share.page_id, p_folder_name));
  end if;
  update public.page_shares
  set recipient_id = auth.uid(), status = 'active', accepted_at = coalesce(accepted_at, now()),
      copy_page_id = v_copy
  where id = p_share_id
  returning * into v_share;
  update public.profiles set onboarded_at = now() where id = auth.uid() and onboarded_at is null;
  return jsonb_build_object('page_id', coalesce(v_share.copy_page_id, v_share.page_id), 'mode', v_share.mode,
                            'share_id', v_share.id);
end;
$$;
revoke execute on function public._activate_share(uuid, text) from public, anon, authenticated;

-- ---------- Do lado de quem envia ----------

create function public.create_share_link(p_page_id uuid, p_mode text default 'live')
returns public.page_share_links
language plpgsql security definer set search_path = ''
as $$
declare
  v_link public.page_share_links;
begin
  if not public.can_share_page(p_page_id) then
    raise exception 'Seu cargo não envia esta página' using errcode = '42501';
  end if;
  if p_mode not in ('live', 'copy') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;
  insert into public.page_share_links (page_id, mode) values (p_page_id, p_mode) returning * into v_link;
  return v_link;
end;
$$;

create function public.revoke_share_link(p_link_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.page_share_links l set revoked_at = now()
  where l.id = p_link_id and public.can_share_page(l.page_id);
end;
$$;

-- Envia por e-mail para várias pessoas (pendente até aceitarem). Devolve quantos convites novos.
create function public.share_page_by_email(p_page_id uuid, p_emails text[], p_mode text default 'live')
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_user uuid;
  v_count integer := 0;
begin
  if not public.can_share_page(p_page_id) then
    raise exception 'Seu cargo não envia esta página' using errcode = '42501';
  end if;
  if p_mode not in ('live', 'copy') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;
  if cardinality(p_emails) > 50 then
    raise exception 'No máximo 50 de uma vez' using errcode = '22023';
  end if;
  foreach v_email in array p_emails loop
    v_email := lower(trim(v_email));
    continue when v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    select id into v_user from auth.users where lower(email) = v_email;
    continue when v_user = auth.uid();
    if v_user is not null then
      insert into public.page_shares (page_id, recipient_id, mode)
      values (p_page_id, v_user, p_mode) on conflict do nothing;
    else
      insert into public.page_shares (page_id, recipient_email, mode)
      values (p_page_id, v_email, p_mode) on conflict do nothing;
    end if;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.revoke_page_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.page_shares s set status = 'revoked'
  where s.id = p_share_id and public.can_share_page(s.page_id) and s.status in ('pending', 'active');
end;
$$;

-- ---------- Do lado de quem recebe ----------

-- Prévia do link (também sem login)
create function public.page_share_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_link public.page_share_links;
  v_page public.pages;
  v_share public.page_shares;
begin
  select * into v_link from public.page_share_links where token = p_token;
  if v_link.id is null or v_link.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'Este link não vale mais.');
  end if;
  if v_link.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'Este link venceu.');
  end if;
  select * into v_page from public.pages where id = v_link.page_id;
  if auth.uid() is not null then
    select * into v_share from public.page_shares
    where page_id = v_link.page_id and recipient_id = auth.uid() and status = 'active';
  end if;
  return jsonb_build_object(
    'valid', true,
    'page_name', v_page.name,
    'page_icon', v_page.icon,
    'view_type', v_page.view_type,
    'mode', v_link.mode,
    'items', (select count(*) from public.tasks where page_id = v_page.id and parent_task_id is null),
    'owner_name', (select display_name from public.profiles where id = v_link.created_by),
    'own', v_link.created_by = auth.uid(),
    'opened_page_id', case when v_share.id is not null then coalesce(v_share.copy_page_id, v_share.page_id) end
  );
end;
$$;

create function public.accept_page_share_link(p_token text, p_folder_name text default 'Recebidas')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_link public.page_share_links;
  v_share uuid;
begin
  if auth.uid() is null then
    raise exception 'Entre para receber a página' using errcode = '42501';
  end if;
  select * into v_link from public.page_share_links where token = p_token;
  if v_link.id is null or v_link.revoked_at is not null or v_link.expires_at < now() then
    raise exception 'Este link não vale mais.' using errcode = 'P0002';
  end if;
  if v_link.created_by = auth.uid() then
    raise exception 'Este link é seu: envie para outra pessoa' using errcode = '22023';
  end if;
  select id into v_share from public.page_shares
  where page_id = v_link.page_id and recipient_id = auth.uid() and status in ('pending', 'active');
  if v_share is null then
    insert into public.page_shares (page_id, owner_id, recipient_id, mode, link_id)
    values (v_link.page_id, v_link.created_by, auth.uid(), v_link.mode, v_link.id)
    returning id into v_share;
  end if;
  return public._activate_share(v_share, p_folder_name);
end;
$$;

-- Convite pendente (por e-mail): aceitar ou recusar
create function public.accept_page_share(p_share_id uuid, p_folder_name text default 'Recebidas')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.page_shares
    where id = p_share_id and status = 'pending'
      and (recipient_id = auth.uid() or (recipient_id is null and recipient_email = public.my_email()))
  ) then
    raise exception 'Convite não encontrado' using errcode = 'P0002';
  end if;
  return public._activate_share(p_share_id, p_folder_name);
end;
$$;

create function public.decline_page_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.page_shares set status = 'revoked'
  where id = p_share_id and status = 'pending'
    and (recipient_id = auth.uid() or (recipient_id is null and recipient_email = public.my_email()));
end;
$$;

revoke execute on function public.create_share_link(uuid, text), public.revoke_share_link(uuid),
  public.share_page_by_email(uuid, text[], text), public.revoke_page_share(uuid),
  public.accept_page_share_link(text, text), public.accept_page_share(uuid, text),
  public.decline_page_share(uuid) from public, anon;
grant execute on function public.create_share_link(uuid, text), public.revoke_share_link(uuid),
  public.share_page_by_email(uuid, text[], text), public.revoke_page_share(uuid),
  public.accept_page_share_link(text, text), public.accept_page_share(uuid, text),
  public.decline_page_share(uuid) to authenticated;
grant execute on function public.page_share_preview(text) to anon, authenticated;
