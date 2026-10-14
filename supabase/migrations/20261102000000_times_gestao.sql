-- V2 §4.3 (E4): gestão do time. Sempre existe pelo menos 1 Dono; tudo o que muda pessoas, cargos
-- e projetos do time fica no log (team_audit).

-- Admin muda Membro e Convidado; só o Dono dá ou tira Admin e Dono. O último Dono não deixa de ser.
create function public.set_team_member_role(p_team_id uuid, p_user_id uuid, p_role public.team_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_current public.team_role;
begin
  select role into v_current from public.team_members where team_id = p_team_id and user_id = p_user_id for update;
  if v_current is null or not public.is_team_member(p_team_id, 'admin') then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
  if (p_role in ('owner', 'admin') or v_current in ('owner', 'admin'))
     and not public.is_team_member(p_team_id, 'owner') then
    raise exception 'Só o Dono mexe em Admins e Donos' using errcode = '42501';
  end if;
  if v_current = 'owner' and p_role <> 'owner' and (
    select count(*) from public.team_members where team_id = p_team_id and role = 'owner') = 1 then
    raise exception 'O time precisa de pelo menos um Dono' using errcode = '22023';
  end if;
  if v_current = p_role then
    return;
  end if;
  update public.team_members set role = p_role where team_id = p_team_id and user_id = p_user_id;
  perform public._team_audit(p_team_id, 'role_changed', p_user_id, jsonb_build_object('from', v_current, 'to', p_role));
end;
$$;

-- Tirar alguém do time (ou sair). Sai também de todos os projetos do time.
create function public.remove_team_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.team_role;
  v_self boolean := p_user_id = auth.uid();
begin
  select role into v_role from public.team_members where team_id = p_team_id and user_id = p_user_id for update;
  if v_role is null or not public.is_team_member(p_team_id) then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
  if not v_self then
    if not public.is_team_member(p_team_id, 'admin') then
      raise exception 'Só Admin ou Dono tira pessoas do time' using errcode = '42501';
    end if;
    if v_role in ('owner', 'admin') and not public.is_team_member(p_team_id, 'owner') then
      raise exception 'Só o Dono tira Admins e Donos' using errcode = '42501';
    end if;
  end if;
  if v_role = 'owner' and (
    select count(*) from public.team_members where team_id = p_team_id and role = 'owner') = 1 then
    raise exception 'O time precisa de pelo menos um Dono: passe o cargo para alguém antes' using errcode = '22023';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
  perform public._team_audit(p_team_id, case when v_self then 'member_left' else 'member_removed' end, p_user_id);
end;
$$;

create function public.teams_audit_rename()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    perform public._team_audit(new.id, 'team_renamed', null, jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  return new;
end;
$$;

create trigger teams_audit_rename
  after update of name on public.teams
  for each row execute function public.teams_audit_rename();

-- Projeto entrando, saindo ou sendo excluído do time
create function public.folders_audit_team()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.team_id is not null and exists (select 1 from public.teams where id = old.team_id) then
      perform public._team_audit(old.team_id, 'project_deleted', null, jsonb_build_object('name', old.name));
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.team_id is not null and old.team_id is distinct from new.team_id then
    perform public._team_audit(old.team_id, 'project_removed', null, jsonb_build_object('name', new.name));
  end if;
  if new.team_id is not null and (tg_op = 'INSERT' or old.team_id is distinct from new.team_id) then
    perform public._team_audit(new.team_id, 'project_added', null, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger folders_audit_team
  after insert or update of team_id or delete on public.folders
  for each row execute function public.folders_audit_team();

-- O time apagado leva o log junto; o Dono é quem apaga (policy teams_delete)

grant execute on function public.set_team_member_role(uuid, uuid, public.team_role) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
