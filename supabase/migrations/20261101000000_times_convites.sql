-- V2 §4.1 (E3): convite para o time por link (validade e limite de usos) ou para um e-mail, e
-- pedido de entrada com aprovação opcional (teams.join_approval). O log de auditoria do time
-- nasce aqui porque convites e entradas já são registrados nele (a tela vem na E4).

create table public.team_audit (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'invite_created', 'invite_revoked', 'member_joined', 'join_requested', 'join_approved',
    'join_denied', 'member_removed', 'member_left', 'role_changed', 'team_renamed',
    'project_added', 'project_removed', 'project_deleted', 'role_created', 'role_updated', 'role_deleted')),
  target_user_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index team_audit_team_idx on public.team_audit (team_id, created_at desc);

create function public._team_audit(p_team_id uuid, p_action text, p_target uuid default null, p_payload jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.team_audit (team_id, actor_id, action, target_user_id, payload)
  values (p_team_id, auth.uid(), p_action, p_target, coalesce(p_payload, '{}'));
$$;

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  role public.team_role not null default 'member' check (role <> 'owner'),
  -- Convite para uma pessoa: só quem entrar com esse e-mail usa, e não passa por aprovação
  email text check (email is null or email = lower(trim(email))),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 500),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index team_invites_team_idx on public.team_invites (team_id);
create index team_invites_email_idx on public.team_invites (email) where email is not null;

create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null check (role <> 'owner'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index team_join_requests_pending on public.team_join_requests (team_id, user_id) where status = 'pending';

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved'));

create function public._my_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

create function public._team_invite_problem(p_invite public.team_invites)
returns text
language sql stable set search_path = ''
as $$
  select case
    when p_invite.id is null then 'Convite não encontrado'
    when p_invite.revoked_at is not null then 'Este convite foi cancelado'
    when p_invite.expires_at <= now() then 'Este convite expirou'
    when p_invite.uses >= p_invite.max_uses then 'Este convite já foi usado o máximo de vezes'
  end;
$$;

-- Admin ou Dono convida. Só o Dono convida alguém já como Admin.
create function public.create_team_invite(
  p_team_id uuid,
  p_role public.team_role default 'member',
  p_days integer default 14,
  p_max_uses integer default 50,
  p_email text default null
)
returns public.team_invites
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_invite public.team_invites;
  v_user uuid;
begin
  if not public.is_team_member(p_team_id, 'admin') then
    raise exception 'Só Admin ou Dono convida para o time' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Convite não dá o cargo de Dono' using errcode = '22023';
  end if;
  if p_role = 'admin' and not public.is_team_member(p_team_id, 'owner') then
    raise exception 'Só o Dono convida Admins' using errcode = '42501';
  end if;
  if p_days not between 1 and 90 then
    raise exception 'Validade entre 1 e 90 dias' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido' using errcode = '22023';
  end if;
  if (select count(*) from public.team_invites where created_by = auth.uid()
      and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Muitos convites em pouco tempo. Tente de novo mais tarde.' using errcode = '54000';
  end if;

  insert into public.team_invites (team_id, role, email, expires_at, max_uses)
  values (p_team_id, p_role, v_email, now() + make_interval(days => p_days),
          case when v_email is null then p_max_uses else 1 end)
  returning * into v_invite;

  perform public._team_audit(p_team_id, 'invite_created', null,
    jsonb_build_object('role', p_role, 'email', v_email, 'days', p_days, 'max_uses', v_invite.max_uses));

  if v_email is not null then
    select id into v_user from auth.users where lower(email) = v_email;
    if v_user is not null then
      perform public._notify(v_user, 'team_invited', jsonb_build_object(
        'team_id', p_team_id, 'team_name', (select name from public.teams where id = p_team_id),
        'token', v_invite.token));
    end if;
  end if;
  return v_invite;
end;
$$;

create function public.revoke_team_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.team_invites;
begin
  select * into v_invite from public.team_invites where id = p_invite_id;
  if v_invite.id is null or not public.is_team_member(v_invite.team_id, 'admin') then
    raise exception 'Convite não encontrado' using errcode = 'P0002';
  end if;
  update public.team_invites set revoked_at = now() where id = p_invite_id and revoked_at is null;
  perform public._team_audit(v_invite.team_id, 'invite_revoked', null,
    jsonb_build_object('role', v_invite.role, 'email', v_invite.email));
end;
$$;

-- O que o link mostra antes de entrar (também sem login: o token é o segredo)
create function public.team_invite_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_invite public.team_invites;
  v_team public.teams;
begin
  select * into v_invite from public.team_invites where token = p_token;
  if public._team_invite_problem(v_invite) is not null then
    return jsonb_build_object('valid', false, 'reason', public._team_invite_problem(v_invite));
  end if;
  select * into v_team from public.teams where id = v_invite.team_id;
  return jsonb_build_object(
    'valid', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'team_icon', v_team.icon,
    'role', v_invite.role,
    'inviter', (select display_name from public.profiles where id = v_invite.created_by),
    'members', (select count(*) from public.team_members where team_id = v_team.id),
    'needs_approval', v_team.join_approval and v_invite.email is null,
    'for_email', v_invite.email is not null,
    'email_matches', v_invite.email is null or v_invite.email = public._my_email(),
    'already_member', auth.uid() is not null and exists (
      select 1 from public.team_members where team_id = v_team.id and user_id = auth.uid()),
    'requested', auth.uid() is not null and exists (
      select 1 from public.team_join_requests where team_id = v_team.id and user_id = auth.uid()
        and status = 'pending')
  );
end;
$$;

create function public._join_team(p_team_id uuid, p_user_id uuid, p_role public.team_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id, role) values (p_team_id, p_user_id, p_role)
  on conflict do nothing;
  if found then
    perform public._team_audit(p_team_id, 'member_joined', p_user_id, jsonb_build_object('role', p_role));
    perform public._notify(m.user_id, 'team_joined', jsonb_build_object(
      'team_id', p_team_id, 'team_name', (select name from public.teams where id = p_team_id),
      'name', (select display_name from public.profiles where id = p_user_id)))
    from public.team_members m
    where m.team_id = p_team_id and m.role in ('owner', 'admin') and m.user_id <> p_user_id;
  end if;
end;
$$;

-- Entra no time, ou pede para entrar quando o time pede aprovação. Devolve o que aconteceu:
-- 'joined', 'requested' ou 'already'.
create function public.accept_team_invite(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.team_invites;
  v_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar o convite' using errcode = '42501';
  end if;
  select * into v_invite from public.team_invites where token = p_token for update;
  if public._team_invite_problem(v_invite) is not null then
    raise exception '%', public._team_invite_problem(v_invite) using errcode = '22023';
  end if;
  if v_invite.email is not null and v_invite.email is distinct from public._my_email() then
    raise exception 'Este convite é para outro e-mail' using errcode = '42501';
  end if;
  select * into v_team from public.teams where id = v_invite.team_id;

  if exists (select 1 from public.team_members where team_id = v_team.id and user_id = auth.uid()) then
    return jsonb_build_object('team_id', v_team.id, 'status', 'already');
  end if;

  update public.team_invites set uses = uses + 1 where id = v_invite.id;

  if v_team.join_approval and v_invite.email is null then
    insert into public.team_join_requests (team_id, user_id, role)
    values (v_team.id, auth.uid(), v_invite.role)
    on conflict do nothing;
    perform public._team_audit(v_team.id, 'join_requested', auth.uid(), jsonb_build_object('role', v_invite.role));
    perform public._notify(m.user_id, 'join_requested', jsonb_build_object(
      'team_id', v_team.id, 'team_name', v_team.name))
    from public.team_members m where m.team_id = v_team.id and m.role in ('owner', 'admin');
    return jsonb_build_object('team_id', v_team.id, 'status', 'requested');
  end if;

  perform public._join_team(v_team.id, auth.uid(), v_invite.role);
  return jsonb_build_object('team_id', v_team.id, 'status', 'joined');
end;
$$;

create function public.decide_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.team_join_requests;
begin
  select * into v_request from public.team_join_requests where id = p_request_id for update;
  if v_request.id is null or not public.is_team_member(v_request.team_id, 'admin') then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Este pedido já foi respondido' using errcode = '22023';
  end if;
  update public.team_join_requests
  set status = case when p_approve then 'approved' else 'denied' end, decided_by = auth.uid(), decided_at = now()
  where id = p_request_id;

  if p_approve then
    perform public._team_audit(v_request.team_id, 'join_approved', v_request.user_id);
    perform public._join_team(v_request.team_id, v_request.user_id, v_request.role);
    perform public._notify(v_request.user_id, 'join_approved', jsonb_build_object(
      'team_id', v_request.team_id, 'team_name', (select name from public.teams where id = v_request.team_id)));
  else
    perform public._team_audit(v_request.team_id, 'join_denied', v_request.user_id);
  end if;
end;
$$;

alter table public.team_audit enable row level security;
alter table public.team_invites enable row level security;
alter table public.team_join_requests enable row level security;

-- Auditoria e convites: Admin e Dono. O convite para o meu e-mail eu também vejo.
create policy "team_audit_select" on public.team_audit for select to authenticated
  using (public.is_team_member(team_id, 'admin'));
create policy "team_invites_select" on public.team_invites for select to authenticated
  using (public.is_team_member(team_id, 'admin') or (email is not null and email = public._my_email()));
create policy "team_join_requests_select" on public.team_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(team_id, 'admin'));

revoke all on public.team_audit, public.team_invites, public.team_join_requests from anon, authenticated;
grant select on public.team_audit, public.team_invites, public.team_join_requests to authenticated;
grant execute on function public.create_team_invite(uuid, public.team_role, integer, integer, text) to authenticated;
grant execute on function public.revoke_team_invite(uuid) to authenticated;
grant execute on function public.team_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
revoke execute on function public._team_audit(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public._join_team(uuid, uuid, public.team_role) from public, anon, authenticated;
revoke execute on function public._my_email() from public, anon;
grant execute on function public._my_email() to authenticated;
