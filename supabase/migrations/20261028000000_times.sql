-- V2 §4: times. Uma pessoa pode estar em vários times; um projeto pertence a um time ou é pessoal
-- (folders.team_id vem na migração seguinte). Quem não é do time não vê nem que ele existe.

create type public.team_role as enum ('owner', 'admin', 'member', 'guest');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text,
  -- Pedido de entrada pelo link precisa de aprovação de um Admin/Dono
  join_approval boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

-- O usuário atual está no time com pelo menos esse cargo? (owner > admin > member > guest)
create function public.team_role_rank(p_role public.team_role)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_role when 'owner' then 4 when 'admin' then 3 when 'member' then 2 else 1 end;
$$;

create function public.is_team_member(p_team_id uuid, p_min_role public.team_role default 'guest')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid()
      and public.team_role_rank(m.role) >= public.team_role_rank(p_min_role)
  );
$$;

-- Quem cria é o Dono
create function public.teams_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger teams_after_insert
  after insert on public.teams
  for each row execute function public.teams_after_insert();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- O created_by no select cobre o insert ... returning (antes do trigger criar o membro)
create policy "teams_select" on public.teams for select to authenticated
  using (created_by = (select auth.uid()) or public.is_team_member(id));
create policy "teams_insert" on public.teams for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "teams_update" on public.teams for update to authenticated
  using (public.is_team_member(id, 'admin')) with check (public.is_team_member(id, 'admin'));
create policy "teams_delete" on public.teams for delete to authenticated
  using (public.is_team_member(id, 'owner'));

-- Entrar, sair e mudar cargo vêm por RPC (convites e tela do time)
create policy "team_members_select" on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

revoke all on public.teams, public.team_members from anon;
grant select, delete on public.teams to authenticated;
grant insert (id, name, icon, join_approval) on public.teams to authenticated;
grant update (name, icon, join_approval) on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant execute on function public.is_team_member(uuid, public.team_role) to authenticated;
