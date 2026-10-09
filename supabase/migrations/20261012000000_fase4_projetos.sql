-- Fase 4: projetos colaborativos (ESCOPO 4.5). Projeto = pasta raiz com is_shared (ESCOPO 3).
--   convites por link (invites + create_invite / invite_preview / accept_invite)
--   papéis (set_member_role / remove_member), responsáveis (task_assignees, com nome pendente)
--   reivindicar nome pendente (claim_pending_assignee), comentários, atividade, notificações in-app
--   modelos de projeto (create_from_template, save_folder_as_template) e Realtime
--
-- Quem casa "@nome" com um membro é o app (para mostrar ambiguidade na pré-visualização, D41).
-- O banco só confere que o user_id é membro. A mesma regra de nome (name_key) existe aqui para as
-- @menções dos comentários e em src/lib/members.ts, com os mesmos casos de teste.

create extension if not exists unaccent with schema extensions;

-- ============================================================
-- Nomes
-- ============================================================

-- "Ana Lima" → "analima"; "@Grégory" → "gregory". Espelho: nameKey (src/lib/members.ts)
create function public.name_key(p_name text)
returns text
language sql stable set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p_name, ''))), '[^a-z0-9]', '', 'g');
$$;

-- Apelidos: nomes pendentes que o membro já reivindicou
alter table public.folder_members add column aliases text[] not null default '{}';

-- Membros da pasta raiz cujo nome casa com o @nome: nome inteiro, primeiro nome ou apelido
-- (nome pendente que a pessoa já reivindicou). Espelho: memberMatches (src/lib/members.ts)
create function public.members_matching(p_root uuid, p_name text)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.user_id
  from public.folder_members m
  join public.profiles p on p.id = m.user_id
  where m.folder_id = p_root
    and public.name_key(p_name) <> ''
    and (public.name_key(p.display_name) = public.name_key(p_name)
         or public.name_key(split_part(trim(p.display_name), ' ', 1)) = public.name_key(p_name)
         or exists (select 1 from unnest(m.aliases) a where public.name_key(a) = public.name_key(p_name)));
$$;

-- ============================================================
-- Atividade e notificações
-- ============================================================

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  -- Sempre a pasta raiz (o projeto)
  folder_id uuid not null references public.folders (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('task_completed', 'tasks_created', 'member_joined', 'comment_added',
                                         'assignee_claimed')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_log_folder_id_created_at_idx on public.activity_log (folder_id, created_at desc);
create index activity_log_completion_idx on public.activity_log ((payload ->> 'completion_id'))
  where action = 'task_completed';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('assigned', 'mention', 'member_joined')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

-- Só projetos têm atividade (pasta pessoal não precisa de "você concluiu X")
create function public._log_activity(p_folder_id uuid, p_action text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
begin
  if exists (select 1 from public.folders where id = v_root and is_shared) then
    insert into public.activity_log (folder_id, user_id, action, payload)
    values (v_root, auth.uid(), p_action, p_payload);
  end if;
end;
$$;

create function public._notify(p_user uuid, p_kind text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Ninguém é notificado do que ele mesmo fez
  if p_user is not null and p_user is distinct from auth.uid() then
    insert into public.notifications (user_id, kind, payload)
    values (p_user, p_kind, p_payload || jsonb_build_object(
      'by', (select display_name from public.profiles where id = auth.uid())));
  end if;
end;
$$;

-- Conclusão registrada = atividade; desfazer apaga a linha (desfazer não deixa rastro)
create function public.task_completions_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public._log_activity(new.folder_id, 'task_completed', jsonb_build_object(
      'task_id', new.task_id, 'completion_id', new.id,
      'title', (select title from public.tasks where id = new.task_id)));
  else
    delete from public.activity_log
    where action = 'task_completed' and payload ->> 'completion_id' = old.id::text;
  end if;
  return null;
end;
$$;

create trigger task_completions_log
  after insert or delete on public.task_completions
  for each row execute function public.task_completions_log();

-- ============================================================
-- Convites
-- ============================================================

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  -- 18 bytes aleatórios em base64 de URL (24 caracteres)
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  role public.folder_role not null default 'editor' check (role <> 'owner'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '14 days',
  max_uses integer not null default 50 check (max_uses > 0),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_folder_id_idx on public.invites (folder_id);

-- Gera (ou reaproveita) o link de convite da pasta. Marca a pasta como projeto.
create function public.create_invite(p_folder_id uuid, p_role public.folder_role default 'editor')
returns public.invites
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder public.folders;
  v_invite public.invites;
begin
  select * into v_folder from public.folders where id = p_folder_id;
  if v_folder.id is null or not public.is_folder_member(p_folder_id, 'editor') then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  if v_folder.is_inbox or v_folder.parent_id is not null then
    raise exception 'Só pastas raiz (fora da Caixa de entrada) podem ser compartilhadas' using errcode = '22023';
  end if;
  if p_role = 'owner' then
    raise exception 'Convite não dá o papel de dono' using errcode = '22023';
  end if;

  -- Mesmo link enquanto ele valer: quem já recebeu não fica com link morto
  select * into v_invite from public.invites
  where folder_id = p_folder_id and role = p_role and revoked_at is null
    and expires_at > now() + interval '1 day' and uses < max_uses
  order by created_at desc limit 1;
  if v_invite.id is null then
    -- Rate limit (ESCOPO 9): 20 links novos por hora por pessoa
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

-- Novo link (o anterior para de funcionar)
create function public.revoke_invites(p_folder_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_folder_member(p_folder_id, 'editor') then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  update public.invites set revoked_at = now() where folder_id = p_folder_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public._invite_problem(p_invite public.invites)
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

-- O que o link mostra antes de entrar (também sem login: o token já é o segredo)
create function public.invite_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_invite public.invites;
  v_folder public.folders;
begin
  select * into v_invite from public.invites where token = p_token;
  if public._invite_problem(v_invite) is not null then
    return jsonb_build_object('valid', false, 'reason', public._invite_problem(v_invite));
  end if;
  select * into v_folder from public.folders where id = v_invite.folder_id;
  return jsonb_build_object(
    'valid', true,
    'folder_id', v_folder.id,
    'folder_name', v_folder.name,
    'folder_icon', v_folder.icon,
    'role', v_invite.role,
    'inviter', (select display_name from public.profiles where id = v_invite.created_by),
    'members', (select count(*) from public.folder_members where folder_id = v_folder.id),
    'already_member', auth.uid() is not null and exists (
      select 1 from public.folder_members where folder_id = v_folder.id and user_id = auth.uid())
  );
end;
$$;

-- Entra no projeto. Devolve a pasta e os nomes pendentes ("Você é o @gregory?")
create function public.accept_invite(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invites;
  v_joined boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar o convite' using errcode = '42501';
  end if;
  select * into v_invite from public.invites where token = p_token for update;
  if public._invite_problem(v_invite) is not null then
    raise exception '%', public._invite_problem(v_invite) using errcode = '22023';
  end if;

  if not exists (select 1 from public.folder_members where folder_id = v_invite.folder_id and user_id = auth.uid()) then
    insert into public.folder_members (folder_id, user_id, role) values (v_invite.folder_id, auth.uid(), v_invite.role);
    update public.invites set uses = uses + 1 where id = v_invite.id;
    v_joined := true;
    perform public._log_activity(v_invite.folder_id, 'member_joined', '{}');
    perform public._notify(m.user_id, 'member_joined', jsonb_build_object(
      'folder_id', v_invite.folder_id, 'folder_name', (select name from public.folders where id = v_invite.folder_id)))
    from public.folder_members m where m.folder_id = v_invite.folder_id and m.role = 'owner';
  end if;

  return jsonb_build_object('folder_id', v_invite.folder_id, 'joined', v_joined,
                            'pending', to_jsonb(public.pending_names(v_invite.folder_id)));
end;
$$;

-- ============================================================
-- Membros
-- ============================================================

create function public.set_member_role(p_folder_id uuid, p_user_id uuid, p_role public.folder_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_folder_member(p_folder_id, 'owner') then
    raise exception 'Só o dono muda papéis' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'O projeto tem um dono só' using errcode = '22023';
  end if;
  update public.folder_members set role = p_role
  where folder_id = public.folder_root(p_folder_id) and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Dono tira alguém, ou a pessoa sai sozinha. As tarefas dela voltam a ser do nome pendente.
create function public.remove_member(p_folder_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
  v_name text;
begin
  if p_user_id <> auth.uid() and not public.is_folder_member(v_root, 'owner') then
    raise exception 'Só o dono tira membros' using errcode = '42501';
  end if;
  if exists (select 1 from public.folder_members where folder_id = v_root and user_id = p_user_id and role = 'owner') then
    raise exception 'O dono não sai do projeto (apague a pasta)' using errcode = '22023';
  end if;
  select left(coalesce(nullif(trim(display_name), ''), 'Alguém'), 50) into v_name from public.profiles where id = p_user_id;

  delete from public.task_assignees a
  where a.user_id = p_user_id and public.folder_root(a.folder_id) = v_root
    and exists (select 1 from public.task_assignees b where b.task_id = a.task_id and lower(b.pending_name) = lower(v_name));
  update public.task_assignees set user_id = null, pending_name = v_name
  where user_id = p_user_id and public.folder_root(folder_id) = v_root;

  delete from public.folder_members where folder_id = v_root and user_id = p_user_id;
  if not found then
    raise exception 'Membro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- ============================================================
-- Responsáveis
-- ============================================================

create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Desnormalizado (= pasta da tarefa), mantido por trigger
  folder_id uuid not null references public.folders (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  -- Responsável pendente: só o nome, até alguém reivindicar (ESCOPO 4.5)
  pending_name text check (char_length(pending_name) between 1 and 50),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (pending_name is null))
);
create unique index task_assignees_task_user_idx on public.task_assignees (task_id, user_id) where user_id is not null;
create unique index task_assignees_task_pending_idx on public.task_assignees (task_id, lower(pending_name))
  where pending_name is not null;
create index task_assignees_user_id_idx on public.task_assignees (user_id);
create index task_assignees_folder_id_idx on public.task_assignees (folder_id);

-- Nomes pendentes do projeto (pasta raiz e subpastas)
create function public.pending_names(p_folder_id uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(n order by n), '{}')
  from (
    select distinct on (lower(a.pending_name)) a.pending_name as n
    from public.task_assignees a
    where public.folder_root(a.folder_id) = public.folder_root(p_folder_id) and a.pending_name is not null
      and public.is_folder_member(p_folder_id)
    order by lower(a.pending_name), a.created_at
  ) names;
$$;

create function public.task_assignees_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select t.folder_id into new.folder_id from public.tasks t where t.id = new.task_id;
  if new.folder_id is null then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  new.pending_name := nullif(trim(leading '@' from trim(new.pending_name)), '');
  if new.user_id is not null and not exists (
    select 1 from public.folder_members
    where folder_id = public.folder_root(new.folder_id) and user_id = new.user_id) then
    raise exception 'Só membros do projeto podem ser responsáveis' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger task_assignees_before_insert
  before insert on public.task_assignees
  for each row execute function public.task_assignees_before_insert();

create function public.task_assignees_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is not null then
    perform public._notify(new.user_id, 'assigned', jsonb_build_object(
      'task_id', new.task_id, 'title', (select title from public.tasks where id = new.task_id),
      'folder_id', public.folder_root(new.folder_id),
      'folder_name', (select name from public.folders where id = public.folder_root(new.folder_id))));
  end if;
  return null;
end;
$$;

create trigger task_assignees_after_insert
  after insert on public.task_assignees
  for each row execute function public.task_assignees_after_insert();

-- Tarefa mudou de pasta: responsáveis e comentários acompanham (folder_id desnormalizado)
create function public.tasks_after_folder_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.task_assignees set folder_id = new.folder_id where task_id = new.id;
  update public.comments set folder_id = new.folder_id where task_id = new.id;
  return null;
end;
$$;

-- "Você é o @gregory?": as tarefas do nome pendente passam para a pessoa (ESCOPO 7).
-- Dono/editor podem vincular outro membro. O nome vira apelido do membro, então os próximos
-- @gregory já caem nele.
create function public.claim_pending_assignee(p_folder_id uuid, p_pending_name text, p_user_id uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(p_folder_id);
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_name text := trim(leading '@' from trim(p_pending_name));
  v_count integer;
begin
  if not public.is_folder_member(v_root) then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  if v_target <> auth.uid() and not public.is_folder_member(v_root, 'editor') then
    raise exception 'Só dono ou editor vinculam outra pessoa' using errcode = '42501';
  end if;
  if not exists (select 1 from public.folder_members where folder_id = v_root and user_id = v_target) then
    raise exception 'Só membros do projeto podem ser responsáveis' using errcode = '22023';
  end if;

  -- Tarefa que já era da pessoa: só some o pendente
  delete from public.task_assignees a
  where lower(a.pending_name) = lower(v_name) and public.folder_root(a.folder_id) = v_root
    and exists (select 1 from public.task_assignees b where b.task_id = a.task_id and b.user_id = v_target);
  update public.task_assignees set user_id = v_target, pending_name = null
  where lower(pending_name) = lower(v_name) and public.folder_root(folder_id) = v_root;
  get diagnostics v_count = row_count;

  if v_count = 0 and not exists (
    select 1 from public.folder_members where folder_id = v_root and user_id = v_target
      and lower(v_name) = any (select lower(a) from unnest(aliases) a)) then
    raise exception 'Nome pendente não encontrado (já foi reivindicado?)' using errcode = 'P0002';
  end if;

  update public.folder_members set aliases = array_append(aliases, v_name)
  where folder_id = v_root and user_id = v_target
    and not (lower(v_name) = any (select lower(a) from unnest(aliases) a));

  perform public._log_activity(v_root, 'assignee_claimed', jsonb_build_object(
    'name', v_name, 'user_id', v_target, 'count', v_count));
  if v_count > 0 then
    perform public._notify(v_target, 'assigned', jsonb_build_object(
      'count', v_count, 'folder_id', v_root, 'folder_name', (select name from public.folders where id = v_root)));
  end if;
  return v_count;
end;
$$;

-- ============================================================
-- Comentários
-- ============================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_task_id_created_at_idx on public.comments (task_id, created_at);
create index comments_folder_id_idx on public.comments (folder_id);

create trigger tasks_after_folder_change
  after update of folder_id on public.tasks
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.tasks_after_folder_change();

create function public.comments_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select t.folder_id into new.folder_id from public.tasks t where t.id = new.task_id;
  if new.folder_id is null then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  new.body := trim(new.body);
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

-- @menção no comentário notifica o membro (mesma regra de nome do app)
create function public.comments_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := (select title from public.tasks where id = new.task_id);
begin
  perform public._log_activity(new.folder_id, 'comment_added', jsonb_build_object(
    'task_id', new.task_id, 'title', v_title, 'comment_id', new.id));
  perform public._notify(u.id, 'mention', jsonb_build_object(
    'task_id', new.task_id, 'title', v_title, 'comment_id', new.id, 'body', left(new.body, 140),
    'folder_id', public.folder_root(new.folder_id)))
  from (
    select distinct public.members_matching(public.folder_root(new.folder_id), m[1]) as id
    from regexp_matches(new.body, '@([^[:space:]@,;:!?()]+)', 'g') m
  ) u;
  return null;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function public.comments_after_insert();

-- ============================================================
-- Lote: aceita responsáveis ({user_id} ou {pending_name}) e registra a atividade
-- ============================================================

create or replace function public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_kind text;
  v_key text;
  v_completion uuid;
  v_page public.pages;
  v_task public.tasks;
  v_recurrence jsonb := case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end;
begin
  if p_parent_id is not null and p_item ? 'children' and jsonb_array_length(p_item -> 'children') > 0 then
    raise exception 'Subtarefa não pode ter subtarefas' using errcode = '22023';
  end if;

  select * into v_page from public.pages where id = p_page_id;
  if v_done then
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_recurrence);
    v_key := public.cycle_key_for(v_kind, public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, labels, recurrence, meta, position,
    created_by, status, completed_by, completed_at, done_cycle_key
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    v_recurrence,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key
  )
  returning * into v_task;
  v_id := v_task.id;

  -- Responsáveis: o trigger confere que o user_id é membro; nome pendente é livre
  insert into public.task_assignees (task_id, user_id, pending_name)
  select v_id, (a ->> 'user_id')::uuid, case when a ? 'user_id' then null else a ->> 'pending_name' end
  from jsonb_array_elements(case when jsonb_typeof(p_item -> 'assignees') = 'array' then p_item -> 'assignees' else '[]' end) a
  on conflict do nothing;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_id, v_task.folder_id, auth.uid(), v_key)
    returning id into v_completion;
    perform public._award_completion(v_task, v_page, v_completion, v_kind, true);
    perform public._refresh_profile_stats(auth.uid());
  end if;
  return v_id;
end;
$$;

create or replace function public.create_tasks_batch(p_page_id uuid, p_items jsonb)
returns setof public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid;
  v_position double precision;
  v_total integer := 0;
  v_item jsonb;
  v_child jsonb;
  v_parent_id uuid;
  v_child_id uuid;
  v_child_position double precision;
begin
  select p.folder_id into v_folder_id from public.pages p where p.id = p_page_id;
  if v_folder_id is null or not public.is_folder_member(v_folder_id, 'editor') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhuma tarefa para criar' using errcode = '22023';
  end if;

  select count(*) + coalesce(sum(jsonb_array_length(coalesce(i -> 'children', '[]'))), 0)
  into v_total
  from jsonb_array_elements(p_items) i;
  if v_total > 500 then
    raise exception 'No máximo 500 tarefas por vez' using errcode = '22023';
  end if;

  select coalesce(max(t.position), 0) into v_position
  from public.tasks t where t.page_id = p_page_id and t.parent_task_id is null;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_parent_id := public._insert_batch_task(p_page_id, null, v_item, v_position);
    return query select * from public.tasks where id = v_parent_id;

    v_child_position := 0;
    for v_child in select * from jsonb_array_elements(coalesce(v_item -> 'children', '[]')) loop
      v_child_position := v_child_position + 1;
      -- Em variável: chamada direta no where rodaria a função uma vez por linha da tabela
      v_child_id := public._insert_batch_task(p_page_id, v_parent_id, v_child, v_child_position);
      return query select * from public.tasks where id = v_child_id;
    end loop;
  end loop;

  perform public._log_activity(v_folder_id, 'tasks_created', jsonb_build_object(
    'count', jsonb_array_length(p_items), 'page_id', p_page_id,
    'title', case when jsonb_array_length(p_items) = 1 then trim(p_items -> 0 ->> 'title') end));
end;
$$;

-- ============================================================
-- Modelos de projeto
-- Formato: {pages: [{name, icon?, view_type?, reset_cycle?, items: [item do create_tasks_batch]}]}
-- Os modelos prontos ficam no app (src/lib/templates.ts); os do usuário, em user_templates.
-- ============================================================

create table public.user_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  icon text,
  data jsonb not null check (jsonb_typeof(data -> 'pages') = 'array'),
  created_at timestamptz not null default now()
);
create index user_templates_owner_id_idx on public.user_templates (owner_id);

create function public.create_from_template(p_name text, p_icon text, p_data jsonb, p_shared boolean default true)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid := gen_random_uuid();
  v_page_id uuid;
  v_page jsonb;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data -> 'pages') <> 'array' or jsonb_array_length(p_data -> 'pages') = 0
     or jsonb_array_length(p_data -> 'pages') > 30 then
    raise exception 'Modelo inválido (de 1 a 30 páginas)' using errcode = '22023';
  end if;

  insert into public.folders (id, owner_id, name, icon, is_shared, position)
  values (v_folder_id, auth.uid(), trim(p_name), nullif(trim(p_icon), ''), p_shared,
          (select coalesce(max(position), 0) + 1 from public.folders where owner_id = auth.uid() and parent_id is null));

  for v_page in select * from jsonb_array_elements(p_data -> 'pages') loop
    v_position := v_position + 1;
    insert into public.pages (folder_id, name, icon, view_type, reset_cycle, position)
    values (v_folder_id, trim(v_page ->> 'name'), nullif(trim(v_page ->> 'icon'), ''),
            coalesce(v_page ->> 'view_type', 'list')::public.page_view_type,
            coalesce(v_page ->> 'reset_cycle', 'none')::public.page_reset_cycle, v_position)
    returning id into v_page_id;
    if jsonb_typeof(v_page -> 'items') = 'array' and jsonb_array_length(v_page -> 'items') > 0 then
      perform public.create_tasks_batch(v_page_id, v_page -> 'items');
    end if;
  end loop;
  -- A atividade de "criou N tarefas" do modelo não interessa a ninguém
  delete from public.activity_log where folder_id = v_folder_id;
  return v_folder_id;
end;
$$;

-- Salva as páginas e tarefas abertas da pasta como modelo (sem responsáveis, datas nem marcações)
create function public.save_folder_as_template(p_folder_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_folder public.folders;
begin
  select * into v_folder from public.folders where id = p_folder_id;
  if v_folder.id is null or not public.is_folder_member(p_folder_id) then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  insert into public.user_templates (name, icon, data)
  select coalesce(nullif(trim(p_name), ''), v_folder.name), v_folder.icon, jsonb_build_object('pages', coalesce(jsonb_agg(
    jsonb_build_object('name', p.name, 'icon', p.icon, 'view_type', p.view_type, 'reset_cycle', p.reset_cycle,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'title', t.title, 'priority', t.priority, 'labels', to_jsonb(t.labels), 'recurrence', t.recurrence,
          'meta', t.meta,
          'children', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title) order by c.position), '[]')
                       from public.tasks c where c.parent_task_id = t.id))
          order by t.position), '[]')
        from public.tasks t where t.page_id = p.id and t.parent_task_id is null))
    order by f.depth, p.position), '[]'))
  from (select id, 0 as depth from public.folders where id = p_folder_id
        union all select id, 1 from public.folders where parent_id = p_folder_id) f
  join public.pages p on p.folder_id = f.id
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- RLS e permissões
-- ============================================================

alter table public.invites enable row level security;
alter table public.task_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.user_templates enable row level security;

revoke all on public.invites, public.task_assignees, public.comments, public.activity_log, public.notifications,
  public.user_templates from anon, authenticated;
grant select on public.invites, public.task_assignees, public.comments, public.activity_log, public.notifications,
  public.user_templates to authenticated;
grant insert (id, task_id, user_id, pending_name), delete on public.task_assignees to authenticated;
grant insert (id, task_id, body), delete on public.comments to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (id, name, icon, data), delete on public.user_templates to authenticated;

create policy "invites_select" on public.invites for select to authenticated
  using (public.is_folder_member(folder_id, 'editor'));

create policy "task_assignees_select" on public.task_assignees for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "task_assignees_insert" on public.task_assignees for insert to authenticated
  with check (public.is_folder_member(folder_id, 'editor'));
create policy "task_assignees_delete" on public.task_assignees for delete to authenticated
  using (public.is_folder_member(folder_id, 'editor'));

-- Leitor também comenta (ESCOPO 4.5: "só vê e comenta")
create policy "comments_select" on public.comments for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.is_folder_member(folder_id) and author_id = (select auth.uid()));
create policy "comments_delete" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_folder_member(folder_id, 'owner'));

create policy "activity_log_select" on public.activity_log for select to authenticated
  using (public.is_folder_member(folder_id));

create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "user_templates_select" on public.user_templates for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "user_templates_insert" on public.user_templates for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "user_templates_delete" on public.user_templates for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke execute on function
  public._log_activity(uuid, text, jsonb), public._notify(uuid, text, jsonb), public._invite_problem(public.invites),
  public.members_matching(uuid, text), public.task_completions_log(), public.task_assignees_before_insert(),
  public.task_assignees_after_insert(), public.tasks_after_folder_change(), public.comments_before_insert(),
  public.comments_after_insert()
  from public, anon, authenticated;

revoke execute on function
  public.create_invite(uuid, public.folder_role), public.revoke_invites(uuid), public.accept_invite(text),
  public.set_member_role(uuid, uuid, public.folder_role), public.remove_member(uuid, uuid),
  public.claim_pending_assignee(uuid, text, uuid), public.pending_names(uuid),
  public.create_from_template(text, text, jsonb, boolean), public.save_folder_as_template(uuid, text)
  from public, anon;
grant execute on function
  public.create_invite(uuid, public.folder_role), public.revoke_invites(uuid), public.accept_invite(text),
  public.set_member_role(uuid, uuid, public.folder_role), public.remove_member(uuid, uuid),
  public.claim_pending_assignee(uuid, text, uuid), public.pending_names(uuid),
  public.create_from_template(text, text, jsonb, boolean), public.save_folder_as_template(uuid, text)
  to authenticated;
-- O link de convite abre antes do login
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ============================================================
-- Realtime: mudanças dos outros aparecem sem recarregar (a RLS vale para quem assina)
-- ============================================================

alter publication supabase_realtime add table public.task_assignees, public.comments, public.activity_log,
  public.notifications, public.folder_members, public.task_completions;
