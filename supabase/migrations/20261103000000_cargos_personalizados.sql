-- V2 §4.3 (E5): cargos personalizados. Cada time monta cargos a partir das permissões atômicas do
-- catálogo (permission_presets); no projeto do time, a pessoa pode receber um desses cargos no
-- lugar do preset. Excluir o projeto continua só do Dono.

create table public.team_roles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  grants text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);

-- Permissões que um cargo personalizado pode ter: o catálogo inteiro (com e sem ":own"), menos
-- excluir o projeto
create function public.grant_catalog()
returns text[]
language sql immutable set search_path = ''
as $$
  select array_agg(distinct g order by g)
  from (
    select jsonb_array_elements_text(value) as g
    from jsonb_each(public.permission_presets() -> 'presets')
    union
    select key || ':own' from jsonb_each(public.permission_presets() -> 'own')
    union
    select key from jsonb_each(public.permission_presets() -> 'own')
  ) c
  where g <> 'project.delete';
$$;

create function public.team_roles_check()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_bad text;
begin
  select g into v_bad from unnest(new.grants) g where not (g = any (public.grant_catalog())) limit 1;
  if v_bad is not null then
    raise exception 'Permissão desconhecida: %', v_bad using errcode = '22023';
  end if;
  new.grants := array(select distinct g from unnest(new.grants) g order by g);
  -- Quem vê o projeto precisa estar em todo cargo
  if not ('project.view' = any (new.grants)) then
    new.grants := array_prepend('project.view', new.grants);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger team_roles_check
  before insert or update on public.team_roles
  for each row execute function public.team_roles_check();

alter table public.folder_members
  add column custom_role_id uuid references public.team_roles (id) on delete set null;
create index folder_members_custom_role_idx on public.folder_members (custom_role_id) where custom_role_id is not null;

-- A conta das permissões a partir de uma lista (preset ou cargo personalizado). ":own" vale só
-- sobre o que é seu (atribuído a si ou criado por si).
create function public.grants_can(
  p_grants text[],
  p_permission text,
  p_is_assignee boolean default false,
  p_is_creator boolean default false
)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    p_permission = any (p_grants)
    or (
      (p_permission || ':own') = any (p_grants)
      and case public.permission_presets() -> 'own' ->> p_permission
            when 'assigned' then p_is_assignee
            when 'created' then p_is_creator
            else false
          end
    ),
    false);
$$;

create or replace function public.has_permission(
  p_folder_id uuid,
  p_permission text,
  p_is_assignee boolean default false,
  p_is_creator boolean default false
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when r.id is not null then public.grants_can(r.grants, p_permission, p_is_assignee, p_is_creator)
      else public.preset_can(m.role::text, p_permission, p_is_assignee, p_is_creator)
    end
    from public.folder_members m
    left join public.team_roles r on r.id = m.custom_role_id
    where m.folder_id = public.folder_root(p_folder_id)
      and m.user_id = auth.uid()
  ), false);
$$;

-- Cargo personalizado para alguém no projeto (só em projeto do time dono do cargo). null tira.
create function public.set_member_custom_role(p_folder_id uuid, p_user_id uuid, p_role_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
begin
  if not public.has_permission(v_root, 'member.manage') then
    raise exception 'Você não pode mudar cargos neste projeto' using errcode = '42501';
  end if;
  if p_role_id is not null and not exists (
    select 1 from public.team_roles r join public.folders f on f.team_id = r.team_id
    where r.id = p_role_id and f.id = v_root) then
    raise exception 'Esse cargo não é do time deste projeto' using errcode = '22023';
  end if;
  -- O cargo comum fica como reserva (se o personalizado for apagado): Leitor, o mais seguro
  update public.folder_members
  set custom_role_id = p_role_id, source = 'direct',
      role = case when p_role_id is null then role else 'viewer'::public.folder_role end
  where folder_id = v_root and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Dar um cargo comum ou voltar ao do time tira o personalizado
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
  update public.folder_members set role = p_role, source = 'direct', custom_role_id = null
  where folder_id = public.folder_root(p_folder_id) and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reset_member_role(p_folder_id uuid, p_user_id uuid)
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
  update public.folder_members set source = 'team', custom_role_id = null
  where folder_id = v_root and user_id = p_user_id;
  perform public._sync_team_access(v_team, p_user_id, v_root);
end;
$$;

-- Cargo personalizado sai junto quando o projeto deixa o time
create function public.folders_drop_custom_roles()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.folder_members m set custom_role_id = null
  from public.team_roles r
  where m.folder_id = new.id and r.id = m.custom_role_id and r.team_id is distinct from new.team_id;
  return new;
end;
$$;

create trigger folders_drop_custom_roles
  after update of team_id on public.folders
  for each row execute function public.folders_drop_custom_roles();

create function public.team_roles_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.teams where id = old.team_id) then
      perform public._team_audit(old.team_id, 'role_deleted', null, jsonb_build_object('name', old.name));
    end if;
    return old;
  end if;
  perform public._team_audit(new.team_id, case tg_op when 'INSERT' then 'role_created' else 'role_updated' end,
    null, jsonb_build_object('name', new.name, 'grants', to_jsonb(new.grants)));
  return new;
end;
$$;

create trigger team_roles_audit
  after insert or update or delete on public.team_roles
  for each row execute function public.team_roles_audit();

alter table public.team_roles enable row level security;

-- Quem é do time vê os cargos (aparecem no projeto); Admin e Dono criam, mudam e apagam
create policy "team_roles_select" on public.team_roles for select to authenticated
  using (public.is_team_member(team_id));
create policy "team_roles_insert" on public.team_roles for insert to authenticated
  with check (public.is_team_member(team_id, 'admin'));
create policy "team_roles_update" on public.team_roles for update to authenticated
  using (public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id, 'admin'));
create policy "team_roles_delete" on public.team_roles for delete to authenticated
  using (public.is_team_member(team_id, 'admin'));

revoke all on public.team_roles from anon, authenticated;
grant select, delete on public.team_roles to authenticated;
grant insert (id, team_id, name, grants) on public.team_roles to authenticated;
grant update (name, grants) on public.team_roles to authenticated;
grant execute on function public.grant_catalog() to authenticated;
grant execute on function public.grants_can(text[], text, boolean, boolean) to authenticated;
grant execute on function public.set_member_custom_role(uuid, uuid, uuid) to authenticated;

-- O aparelho precisa das permissões do cargo para esconder o que não pode (o servidor decide)
alter publication powersync add table public.team_roles;

-- Nos limites por nível que ainda restam (RPCs e policies com 'editor'), quem tem cargo
-- personalizado com alguma permissão de escrita conta como Editor; o detalhe fica com os guardas
-- (zz_tasks_permission, zz_pages_permission) e o has_permission.
create or replace function public.is_folder_member(p_folder_id uuid, p_min_role public.folder_role default 'viewer')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.folder_members m
    left join public.team_roles r on r.id = m.custom_role_id
    where m.folder_id = public.folder_root(p_folder_id)
      and m.user_id = auth.uid()
      and case
            when r.id is null then public.folder_role_rank(m.role)
            when exists (select 1 from unnest(r.grants) g where g not in ('project.view', 'comment.create')) then 2
            else 1
          end >= public.folder_role_rank(p_min_role)
  );
$$;
