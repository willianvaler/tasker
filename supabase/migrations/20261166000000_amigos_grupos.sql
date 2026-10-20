-- ESCOPO_V10 §3 (AM3, D231): adicionar um amigo direto num projeto (e grupo de treino), time ou clã.
-- A amizade aceita já é o consentimento (V10-2, padrão até o dono responder): entra direto, com o
-- aviso `added_to_group`, e pode sair quando quiser. Só quem já pode convidar naquele grupo adiciona.

create function public.add_friend_to_group(
  p_friend uuid,
  p_folder_id uuid default null,
  p_team_id uuid default null,
  p_clan boolean default false,
  p_role text default 'contributor'
)
returns text -- 'added' | 'already'
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_folder public.folders;
  v_team public.teams;
  v_clan uuid;
  v_name text;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not public.are_friends(v_me, p_friend) then
    raise exception 'Só dá para adicionar amigos' using errcode = '42501';
  end if;
  if (p_folder_id is not null)::int + (p_team_id is not null)::int + p_clan::int <> 1 then
    raise exception 'Escolha um projeto, um time ou o clã' using errcode = '22023';
  end if;

  if p_folder_id is not null then
    select * into v_folder from public.folders where id = public.folder_root(p_folder_id);
    if v_folder.id is null or not public.is_folder_member(v_folder.id) then
      raise exception 'Pasta não encontrada' using errcode = 'P0002';
    end if;
    if not public.has_permission(v_folder.id, 'member.manage') then
      raise exception 'Seu cargo não convida pessoas' using errcode = '42501';
    end if;
    if v_folder.is_inbox or v_folder.is_gym then
      raise exception 'Esta pasta não se compartilha' using errcode = '22023';
    end if;
    if p_role not in ('manager', 'editor', 'contributor', 'viewer') then
      raise exception 'Cargo inválido' using errcode = '22023';
    end if;
    if exists (select 1 from public.folder_members where folder_id = v_folder.id and user_id = p_friend) then
      return 'already';
    end if;
    -- Pasta pessoal vira projeto, como no primeiro convite
    update public.folders set kind = 'project', is_shared = true
    where id = v_folder.id and (kind <> 'project' or not is_shared);
    insert into public.folder_members (folder_id, user_id, role)
    values (v_folder.id, p_friend, p_role::public.folder_role);
    perform public._notify(p_friend, 'added_to_group', jsonb_build_object(
      'folder_id', v_folder.id, 'group_name', v_folder.name));
    return 'added';
  end if;

  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if v_team.id is null or not public.is_team_member(p_team_id, 'admin') then
      raise exception 'Só quem administra o time adiciona pessoas' using errcode = '42501';
    end if;
    if exists (select 1 from public.team_members where team_id = p_team_id and user_id = p_friend) then
      return 'already';
    end if;
    perform public._join_team(p_team_id, p_friend, 'member');
    perform public._notify(p_friend, 'added_to_group', jsonb_build_object(
      'team_id', p_team_id, 'group_name', v_team.name));
    return 'added';
  end if;

  v_clan := public.my_clan();
  if v_clan is null then
    raise exception 'Você não está num clã' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.clan_members where user_id = p_friend) then
    if exists (select 1 from public.clan_members where user_id = p_friend and clan_id = v_clan) then
      return 'already';
    end if;
    raise exception 'Esse amigo já está em outro clã' using errcode = '22023';
  end if;
  select name into v_name from public.clans where id = v_clan;
  insert into public.clan_members (clan_id, user_id) values (v_clan, p_friend);
  perform public._clan_log(v_clan, p_friend, 'joined', '{}');
  perform public._notify(p_friend, 'added_to_group', jsonb_build_object('clan', true, 'group_name', v_name));
  return 'added';
end;
$$;

revoke execute on function public.add_friend_to_group(uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.add_friend_to_group(uuid, uuid, uuid, boolean, text) to authenticated;
