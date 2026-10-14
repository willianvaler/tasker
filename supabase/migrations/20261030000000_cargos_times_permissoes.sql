-- V2 §4.2/§4.3 (E2): projeto de time, cargo no projeto sobrescrevendo o do time e permissões como
-- dados nas policies.
--
-- O acesso continua morando em folder_members (a RLS e o sync já leem dali): quem é do time ganha
-- uma linha source = 'team' em cada projeto do time, com o cargo que o cargo no time dá. Um cargo
-- dado no próprio projeto vira source = 'direct' e passa a valer no lugar do do time. Convidado do
-- time só entra nos projetos para onde for chamado.

alter table public.folders
  add column team_id uuid references public.teams (id) on delete set null;
alter table public.folders
  add constraint folders_team_is_project check (team_id is null or (kind = 'project' and parent_id is null));
create index folders_team_id_idx on public.folders (team_id) where team_id is not null;

alter table public.folder_members
  add column source text not null default 'direct' check (source in ('direct', 'team'));

-- Cargo no time → cargo nos projetos do time
create function public.team_role_preset(p_role public.team_role)
returns public.folder_role
language sql immutable set search_path = ''
as $$
  select case p_role
    when 'owner' then 'owner'::public.folder_role
    when 'admin' then 'manager'::public.folder_role
    when 'member' then 'editor'::public.folder_role
  end;
$$;

-- Ordem dos cargos no projeto, para os limites que ainda são por nível (is_folder_member)
create function public.folder_role_rank(p_role public.folder_role)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_role
    when 'owner' then 4 when 'manager' then 3 when 'editor' then 2 when 'contributor' then 2 else 1 end;
$$;

-- O Colaborador passa no limite 'editor' das RPCs antigas; o que ele pode de fato fazer em cada
-- tarefa ou página é decidido pelos guardas abaixo, com has_permission.
create or replace function public.is_folder_member(p_folder_id uuid, p_min_role public.folder_role default 'viewer')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.folder_members m
    where m.folder_id = public.folder_root(p_folder_id)
      and m.user_id = auth.uid()
      and public.folder_role_rank(m.role) >= public.folder_role_rank(p_min_role)
  );
$$;

-- Tira a pessoa do projeto: as tarefas dela voltam a ser do nome pendente
create function public._detach_member(p_root uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select left(coalesce(nullif(trim(display_name), ''), 'Alguém'), 50) into v_name from public.profiles where id = p_user_id;
  delete from public.task_assignees a
  where a.user_id = p_user_id and public.folder_root(a.folder_id) = p_root
    and exists (select 1 from public.task_assignees b where b.task_id = a.task_id and lower(b.pending_name) = lower(v_name));
  update public.task_assignees set user_id = null, pending_name = v_name
  where user_id = p_user_id and public.folder_root(folder_id) = p_root;
  delete from public.folder_members where folder_id = p_root and user_id = p_user_id;
end;
$$;

-- Acerta o acesso de uma pessoa aos projetos de um time (ou a um projeto só)
create function public._sync_team_access(p_team_id uuid, p_user_id uuid, p_folder_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.team_role;
  v_preset public.folder_role;
  v_folder uuid;
begin
  select role into v_role from public.team_members where team_id = p_team_id and user_id = p_user_id;
  v_preset := public.team_role_preset(v_role);

  for v_folder in
    select id from public.folders where team_id = p_team_id and (p_folder_id is null or id = p_folder_id)
  loop
    if v_role is null then
      -- Saiu do time: sai de todos os projetos dele
      if exists (select 1 from public.folder_members where folder_id = v_folder and user_id = p_user_id) then
        perform public._detach_member(v_folder, p_user_id);
      end if;
    elsif v_preset is null then
      delete from public.folder_members where folder_id = v_folder and user_id = p_user_id and source = 'team';
    else
      insert into public.folder_members (folder_id, user_id, role, source)
      values (v_folder, p_user_id, v_preset, 'team')
      on conflict (folder_id, user_id) do update set role = excluded.role
        where public.folder_members.source = 'team';
    end if;
  end loop;
end;
$$;

create function public.team_members_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public._sync_team_access(old.team_id, old.user_id);
    return old;
  end if;
  perform public._sync_team_access(new.team_id, new.user_id);
  return new;
end;
$$;

create trigger team_members_sync
  after insert or update of role or delete on public.team_members
  for each row execute function public.team_members_sync();

-- Projeto nasce no time ou entra nele: as pessoas do time entram com o cargo do time. Quem criou
-- fica pelo menos como Gerente (mantém o que já tinha no time, se for mais).
create or replace function public.folders_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_id is null then
    if new.team_id is null then
      insert into public.folder_members (folder_id, user_id, role) values (new.id, new.owner_id, 'owner');
    else
      perform public._sync_team_access(new.team_id, m.user_id, new.id)
      from public.team_members m where m.team_id = new.team_id;
      insert into public.folder_members (folder_id, user_id, role, source)
      values (new.id, new.owner_id, 'manager', 'direct')
      on conflict (folder_id, user_id) do update set role = 'manager', source = 'direct'
        where public.folder_role_rank(public.folder_members.role) < public.folder_role_rank('manager');
    end if;
  end if;
  return new;
end;
$$;

-- Mover um projeto para um time (ou tirar dele). Entrar: Dono do projeto e Admin do time. Sair: só
-- quem pode excluir o projeto; quem ficou vira membro direto com o mesmo cargo e quem moveu fica Dono.
create function public.set_project_team(p_folder_id uuid, p_team_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder public.folders;
begin
  select * into v_folder from public.folders where id = p_folder_id for update;
  if v_folder.id is null or not public.is_folder_member(p_folder_id) then
    raise exception 'Projeto não encontrado' using errcode = 'P0002';
  end if;
  if not public.has_permission(p_folder_id, 'project.delete') then
    raise exception 'Só o Dono do projeto muda o time' using errcode = '42501';
  end if;
  if v_folder.parent_id is not null or v_folder.is_inbox then
    raise exception 'Só pastas raiz entram num time' using errcode = '22023';
  end if;
  if p_team_id is not null and not public.is_team_member(p_team_id, 'admin') then
    raise exception 'Só Admin ou Dono do time traz projetos para ele' using errcode = '42501';
  end if;
  if v_folder.team_id is not distinct from p_team_id then
    return;
  end if;

  if v_folder.team_id is not null and p_team_id is null then
    update public.folder_members set source = 'direct',
      role = case when role = 'owner' then 'manager'::public.folder_role else role end
    where folder_id = p_folder_id;
  elsif v_folder.team_id is not null then
    -- De um time para outro: quem vinha do time antigo sai
    perform public._detach_member(p_folder_id, m.user_id)
    from public.folder_members m
    where m.folder_id = p_folder_id and m.source = 'team' and m.user_id <> auth.uid();
  end if;
  -- Quem moveu: Dono no projeto pessoal; no time, o cargo vem do time
  delete from public.folder_members where folder_id = p_folder_id and user_id = auth.uid();

  update public.folders set team_id = p_team_id, kind = 'project', is_shared = true where id = p_folder_id;

  if p_team_id is null then
    insert into public.folder_members (folder_id, user_id, role) values (p_folder_id, auth.uid(), 'owner');
  else
    -- O Dono antigo do projeto pessoal não guarda "Dono" por cima do time
    update public.folder_members set role = 'manager' where folder_id = p_folder_id and role = 'owner';
    perform public._sync_team_access(p_team_id, m.user_id, p_folder_id)
    from public.team_members m where m.team_id = p_team_id;
  end if;
  perform public._log_activity(p_folder_id, 'project_team_changed', jsonb_build_object('team_id', p_team_id));
end;
$$;

-- Time excluído: os projetos dele ficam com quem estava, como membros diretos
create function public.teams_before_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.folder_members m set source = 'direct'
  from public.folders f
  where f.team_id = old.id and m.folder_id = f.id;
  return old;
end;
$$;

create trigger teams_before_delete
  before delete on public.teams
  for each row execute function public.teams_before_delete();

-- Projeto de time é sempre projeto compartilhado
create or replace function public.folders_shared_is_project()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.team_id is not null then
    new.is_shared := true;
  end if;
  if new.is_shared and new.parent_id is null then
    new.kind := 'project';
  end if;
  return new;
end;
$$;

drop trigger folders_shared_is_project on public.folders;
create trigger folders_shared_is_project
  before insert or update of is_shared, kind, team_id on public.folders
  for each row execute function public.folders_shared_is_project();

-- Cargo no projeto. Num projeto de time, vira um cargo próprio que vale no lugar do do time.
create or replace function public.set_member_role(p_folder_id uuid, p_user_id uuid, p_role public.folder_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_permission(p_folder_id, 'member.manage') then
    raise exception 'Você não pode mudar cargos neste projeto' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Cargo de Dono não se dá por aqui' using errcode = '22023';
  end if;
  update public.folder_members set role = p_role, source = 'direct'
  where folder_id = public.folder_root(p_folder_id) and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Volta a usar o cargo do time
create function public.reset_member_role(p_folder_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
  v_team uuid := (select team_id from public.folders where id = v_root);
begin
  if not public.has_permission(v_root, 'member.manage') then
    raise exception 'Você não pode mudar cargos neste projeto' using errcode = '42501';
  end if;
  if v_team is null or not exists (
    select 1 from public.team_members where team_id = v_team and user_id = p_user_id
      and public.team_role_preset(role) is not null) then
    raise exception 'Essa pessoa não tem cargo vindo do time' using errcode = '22023';
  end if;
  update public.folder_members set source = 'team' where folder_id = v_root and user_id = p_user_id;
  perform public._sync_team_access(v_team, p_user_id, v_root);
end;
$$;

-- Tirar alguém (ou sair). Quem está no projeto pelo time sai pelo time.
create or replace function public.remove_member(p_folder_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
  v_member public.folder_members;
begin
  if p_user_id <> auth.uid() and not public.has_permission(v_root, 'member.manage') then
    raise exception 'Você não pode tirar pessoas deste projeto' using errcode = '42501';
  end if;
  select * into v_member from public.folder_members where folder_id = v_root and user_id = p_user_id;
  if v_member.user_id is null then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
  if v_member.role = 'owner' then
    raise exception 'O dono não sai do projeto (apague a pasta)' using errcode = '22023';
  end if;
  if v_member.source = 'team' then
    raise exception 'Essa pessoa está no projeto pelo time: mude o cargo dela aqui ou tire do time' using errcode = '22023';
  end if;
  perform public._detach_member(v_root, p_user_id);
end;
$$;

-- ============================================================
-- Guardas por permissão. Rodam também dentro das RPCs security definer (auth.uid() continua sendo
-- quem chamou); sem usuário (cron, superusuário) não checam.
-- ============================================================

create function public.is_task_assignee(p_task_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.task_assignees where task_id = p_task_id and user_id = p_user_id);
$$;

create function public.zz_tasks_permission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task public.tasks := case when tg_op = 'DELETE' then old else new end;
  v_assignee boolean;
  v_creator boolean;
begin
  if v_uid is null then
    return v_task;
  end if;
  v_creator := v_task.created_by = v_uid;
  v_assignee := tg_op <> 'INSERT' and public.is_task_assignee(v_task.id, v_uid);

  if tg_op = 'INSERT' then
    if not public.has_permission(new.folder_id, 'task.create') then
      raise exception 'Seu cargo não cria tarefas aqui' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' then
    if not public.has_permission(old.folder_id, 'task.delete', v_assignee, v_creator) then
      raise exception 'Seu cargo não apaga esta tarefa' using errcode = '42501';
    end if;
  elsif not (
    public.has_permission(old.folder_id, 'task.edit')
    or public.has_permission(old.folder_id, 'task.complete', v_assignee, v_creator)
    or (v_creator and public.has_permission(old.folder_id, 'task.create'))
  ) then
    raise exception 'Seu cargo não altera esta tarefa' using errcode = '42501';
  end if;
  return v_task;
end;
$$;

create trigger zz_tasks_permission
  before insert or update or delete on public.tasks
  for each row execute function public.zz_tasks_permission();

-- Páginas: criar, apagar e mexer na estrutura pedem page.manage; reiniciar o ciclo manual, só
-- poder concluir.
create function public.zz_pages_permission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_page public.pages := case when tg_op = 'DELETE' then old else new end;
begin
  if auth.uid() is null then
    return v_page;
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['manual_cycle', 'updated_at', 'updated_by', 'version'])
       = (to_jsonb(old) - array['manual_cycle', 'updated_at', 'updated_by', 'version']) then
    if not public.has_permission(old.folder_id, 'task.complete')
       and not public.has_permission(old.folder_id, 'task.complete', true) then
      raise exception 'Seu cargo não reinicia esta página' using errcode = '42501';
    end if;
    return new;
  end if;
  if not public.has_permission(v_page.folder_id, 'page.manage') then
    raise exception 'Seu cargo não muda páginas aqui' using errcode = '42501';
  end if;
  return v_page;
end;
$$;

create trigger zz_pages_permission
  before insert or update or delete on public.pages
  for each row execute function public.zz_pages_permission();

-- ============================================================
-- Policies por permissão
-- ============================================================

drop policy "folders_insert" on public.folders;
create policy "folders_insert" on public.folders for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (parent_id is null or public.has_permission(parent_id, 'page.manage'))
    and (team_id is null or public.is_team_member(team_id, 'member'))
  );
drop policy "folders_update" on public.folders;
create policy "folders_update" on public.folders for update to authenticated
  using (public.has_permission(id, 'page.manage')) with check (public.has_permission(id, 'page.manage'));
drop policy "folders_delete" on public.folders;
create policy "folders_delete" on public.folders for delete to authenticated
  using (
    not is_inbox
    and public.has_permission(id, case when parent_id is null then 'project.delete' else 'page.manage' end)
  );

drop policy "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (public.has_permission(folder_id, 'task.create') and created_by = (select auth.uid()));

drop policy "task_assignees_insert" on public.task_assignees;
create policy "task_assignees_insert" on public.task_assignees for insert to authenticated
  with check (public.has_permission(folder_id, 'task.assign'));
drop policy "task_assignees_delete" on public.task_assignees;
create policy "task_assignees_delete" on public.task_assignees for delete to authenticated
  using (public.has_permission(folder_id, 'task.assign'));

drop policy "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.has_permission(folder_id, 'comment.create') and author_id = (select auth.uid()));
drop policy "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.has_permission(folder_id, 'member.manage'));

drop policy "invites_select" on public.invites;
create policy "invites_select" on public.invites for select to authenticated
  using (public.has_permission(folder_id, 'member.manage'));

-- Convidar e gerar novo link pedem member.manage (Gerente e Dono)
create or replace function public.create_invite(p_folder_id uuid, p_role public.folder_role default 'editor')
returns public.invites
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder public.folders;
  v_invite public.invites;
begin
  select * into v_folder from public.folders where id = p_folder_id;
  if v_folder.id is null or not public.is_folder_member(p_folder_id) then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  if not public.has_permission(p_folder_id, 'member.manage') then
    raise exception 'Seu cargo não convida pessoas' using errcode = '42501';
  end if;
  if v_folder.is_inbox or v_folder.parent_id is not null then
    raise exception 'Só pastas raiz (fora da Caixa de entrada) podem ser compartilhadas' using errcode = '22023';
  end if;
  if p_role = 'owner' then
    raise exception 'Convite não dá o papel de dono' using errcode = '22023';
  end if;

  select * into v_invite from public.invites
  where folder_id = p_folder_id and role = p_role and revoked_at is null
    and expires_at > now() + interval '1 day' and uses < max_uses
  order by created_at desc limit 1;
  if v_invite.id is null then
    if (select count(*) from public.invites where created_by = auth.uid()
        and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Muitos convites em pouco tempo. Tente de novo mais tarde.' using errcode = '54000';
    end if;
    insert into public.invites (folder_id, role) values (p_folder_id, p_role) returning * into v_invite;
  end if;

  update public.folders set is_shared = true where id = p_folder_id and not is_shared;
  return v_invite;
end;
$$;

create or replace function public.revoke_invites(p_folder_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_permission(p_folder_id, 'member.manage') then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  update public.invites set revoked_at = now() where folder_id = p_folder_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant insert (team_id) on public.folders to authenticated;
grant execute on function public.set_project_team(uuid, uuid) to authenticated;
grant execute on function public.reset_member_role(uuid, uuid) to authenticated;
revoke execute on function public._detach_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._sync_team_access(uuid, uuid, uuid) from public, anon, authenticated;
