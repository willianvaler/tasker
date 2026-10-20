-- ESCOPO_V10 §1 (AM1, D230): amigos por nick, por e-mail e por link.
-- Nick (`profiles.username`): único, 3 a 20 de [a-z0-9_.]. Toda conta ganha um a partir do nome
-- (trigger), e troca pelo `set_username`. Amizade = um par ordenado em `friendships` (user_a < user_b),
-- pendente até a outra pessoa aceitar. O link de amizade (`friend_links`) vira amizade na hora: quem
-- compartilhou já concordou. Tudo muda por RPC; cada um lê só as próprias linhas.

-- ---------- Nick

alter table public.profiles add column username text
  check (username ~ '^[a-z0-9_.]{3,20}$');
create unique index profiles_username_key on public.profiles (username);

-- "Ana Souza" → "ana.souza"; "Zé" → "ze.user"; repetido ganha número no fim ("ana.souza2")
create function public._suggest_username(p_name text, p_self uuid default null)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_base text;
  v_try text;
  n integer := 1;
begin
  v_base := lower(translate(coalesce(p_name, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '.', 'g');
  v_base := trim(both '.' from v_base);
  v_base := left(v_base, 16);
  v_base := trim(both '.' from v_base);
  if char_length(v_base) < 3 then
    v_base := left(v_base || case when v_base = '' then 'user' else '.user' end, 16);
  end if;
  v_try := v_base;
  while exists (select 1 from public.profiles where username = v_try and id is distinct from p_self) loop
    n := n + 1;
    -- Depois de umas tentativas, um número sorteado (nome muito comum não vira laço longo)
    v_try := left(v_base, 16) || case when n <= 5 then n::text else (1000 + floor(random() * 9000))::int::text end;
  end loop;
  return v_try;
end;
$$;

create function public.profiles_username_default()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.username is null then
    new.username := public._suggest_username(new.display_name, new.id);
  end if;
  return new;
end;
$$;
create trigger profiles_username_default before insert on public.profiles
  for each row execute function public.profiles_username_default();

-- Contas que já existem: um nick cada, na ordem de criação
do $$
declare
  r record;
begin
  for r in select id, display_name from public.profiles where username is null order by created_at, id loop
    update public.profiles set username = public._suggest_username(r.display_name, r.id) where id = r.id;
  end loop;
end;
$$;
alter table public.profiles alter column username set not null;

/** Troca o nick. Devolve o nick salvo; recusa formato inválido (22023) ou nick de outra pessoa (23505). */
create function public.set_username(p_username text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := lower(trim(coalesce(p_username, '')));
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  v_name := ltrim(v_name, '@');
  if v_name !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Nick: 3 a 20 letras minúsculas, números, _ ou .' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where username = v_name and id <> auth.uid()) then
    raise exception 'Esse nick já é de outra pessoa' using errcode = '23505';
  end if;
  update public.profiles set username = v_name where id = auth.uid();
  return v_name;
end;
$$;

-- ---------- Amizades

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);
alter table public.friendships enable row level security;
revoke insert, update, delete on public.friendships from anon, authenticated;
create policy "friendships_select" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

/** São amigos (aceito)? Para as outras partes do V10 (visibilidade, vincular em grupos). */
create function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted'
  );
$$;

-- Pede (ou aceita, se a outra pessoa já tinha pedido). Devolve o estado: 'sent', 'accepted',
-- 'already' (já amigos ou já pedido), 'self'.
create function public._friend_request_to(p_other uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_row public.friendships;
begin
  if p_other = v_me then
    return 'self';
  end if;
  select * into v_row from public.friendships
  where user_a = least(v_me, p_other) and user_b = greatest(v_me, p_other) for update;
  if v_row.user_a is null then
    insert into public.friendships (user_a, user_b, requested_by)
    values (least(v_me, p_other), greatest(v_me, p_other), v_me);
    perform public._notify(p_other, 'friend_request', jsonb_build_object('user_id', v_me));
    return 'sent';
  end if;
  if v_row.status = 'pending' and v_row.requested_by <> v_me then
    update public.friendships set status = 'accepted', accepted_at = now()
    where user_a = v_row.user_a and user_b = v_row.user_b;
    perform public._notify(p_other, 'friend_accepted', jsonb_build_object('user_id', v_me));
    return 'accepted';
  end if;
  return 'already';
end;
$$;

/**
 * Pedir amizade por nick ou por e-mail. Por e-mail, a resposta não diz se a conta existe
 * ('sent' de qualquer jeito); por nick, 'not_found' quando não há ninguém.
 */
create function public.friend_request(p_username text default null, p_email text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_other uuid;
  v_result text;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if nullif(trim(p_username), '') is not null then
    select id into v_other from public.profiles where username = lower(ltrim(trim(p_username), '@'));
    if v_other is null then
      return 'not_found';
    end if;
    return public._friend_request_to(v_other);
  end if;
  if nullif(trim(p_email), '') is null then
    raise exception 'Informe o nick ou o e-mail' using errcode = '22023';
  end if;
  select id into v_other from auth.users where lower(email) = lower(trim(p_email));
  if v_other is null then
    return 'sent';
  end if;
  v_result := public._friend_request_to(v_other);
  -- Não revela pelo e-mail se já eram amigos ou se é a própria conta
  return case when v_result = 'accepted' then 'accepted' else 'sent' end;
end;
$$;

/** Aceitar ou recusar um pedido recebido. Recusar apaga o pedido (sem avisar quem pediu). */
create function public.friend_respond(p_user uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.friendships
    where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user)
      and status = 'pending' and requested_by = p_user
  ) then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
    perform public._notify(p_user, 'friend_accepted', jsonb_build_object('user_id', v_me));
  else
    delete from public.friendships where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
  end if;
end;
$$;

/** Desfaz a amizade, ou cancela o pedido que fiz. Sem aviso para a outra pessoa. */
create function public.friend_remove(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.friendships
  where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
$$;

/** Meus amigos e pedidos, com nome, nick e avatar (o perfil de quem não é do projeto não é legível). */
create function public.my_friends()
returns table (user_id uuid, display_name text, username text, avatar_url text, status text,
               incoming boolean, since timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.avatar_url, f.status,
         f.status = 'pending' and f.requested_by <> auth.uid(),
         coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, p.display_name;
$$;

/** Pessoa pelo nick exato (para "adicionar por nick"): nome, nick, avatar e se já é amiga. */
create function public.find_by_username(p_username text)
returns table (user_id uuid, display_name text, username text, avatar_url text, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.avatar_url,
         (select f.status from public.friendships f
          where f.user_a = least(auth.uid(), p.id) and f.user_b = greatest(auth.uid(), p.id))
  from public.profiles p
  where auth.uid() is not null and p.username = lower(ltrim(trim(coalesce(p_username, '')), '@'));
$$;

-- ---------- Link de amizade

create table public.friend_links (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.friend_links enable row level security;
revoke insert, update, delete on public.friend_links from anon, authenticated;
create policy "friend_links_select" on public.friend_links for select to authenticated
  using (user_id = (select auth.uid()));

create function public._friend_token()
returns text
language sql volatile set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');
$$;

/** Meu link (cria na primeira vez); p_reset troca o token e o antigo para de valer. */
create function public.friend_link(p_reset boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if p_reset then
    delete from public.friend_links where user_id = auth.uid();
  end if;
  select token into v_token from public.friend_links where user_id = auth.uid();
  if v_token is null then
    v_token := public._friend_token();
    insert into public.friend_links (user_id, token) values (auth.uid(), v_token);
  end if;
  return v_token;
end;
$$;

/** Prévia do link (fora do login): o nome e o nick de quem convida. */
create function public.friend_link_preview(p_token text)
returns table (display_name text, username text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select p.display_name, p.username, p.avatar_url
  from public.friend_links l join public.profiles p on p.id = l.user_id
  where l.token = p_token;
$$;

/** Entrar pelo link: amizade aceita na hora. Devolve o id de quem convidou. */
create function public.friend_link_accept(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  select user_id into v_owner from public.friend_links where token = p_token;
  if v_owner is null then
    raise exception 'Link inválido ou trocado' using errcode = 'P0002';
  end if;
  if v_owner = v_me then
    return v_owner;
  end if;
  insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
  values (least(v_me, v_owner), greatest(v_me, v_owner), v_owner, 'accepted', now())
  on conflict (user_a, user_b) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now());
  perform public._notify(v_owner, 'friend_accepted', jsonb_build_object('user_id', v_me));
  return v_owner;
end;
$$;

-- ---------- Avisos

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group'));

-- ---------- Permissões das funções

revoke execute on function public._suggest_username(text, uuid), public.profiles_username_default(),
  public._friend_request_to(uuid), public._friend_token()
  from public, anon, authenticated;
revoke execute on function public.set_username(text), public.are_friends(uuid, uuid),
  public.friend_request(text, text), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.my_friends(), public.find_by_username(text), public.friend_link(boolean),
  public.friend_link_accept(text)
  from public, anon;
grant execute on function public.set_username(text), public.are_friends(uuid, uuid),
  public.friend_request(text, text), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.my_friends(), public.find_by_username(text), public.friend_link(boolean),
  public.friend_link_accept(text)
  to authenticated;
grant execute on function public.friend_link_preview(text) to anon, authenticated;

alter publication supabase_realtime add table public.friendships;

-- Exportar meus dados (LGPD): o nick já vai no perfil; os amigos entram aqui
create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    -- V10: amigos (nick e desde quando) e o link de amizade
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', f.username, 'status', f.status, 'since', f.since))
                         from public.my_friends() f), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;

-- Política de privacidade com o nick e os amigos (dado novo): todo mundo aceita de novo (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-20' $$;
