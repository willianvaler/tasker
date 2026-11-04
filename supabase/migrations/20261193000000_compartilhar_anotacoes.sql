-- OB14 (ESCOPO_V11 §8, D300): compartilhar uma anotação pessoal com amigos, para ler ou
-- editar. Antes do CRDT (V3 §6 C) vale "a última gravação vence" e o app avisa "mudou enquanto
-- você editava" (V11-3). A anotação de pasta ou projeto já é de quem é da pasta (D236): o
-- compartilhamento é só das pessoais (a pasta de uma anotação não muda depois de criada).
-- Quem recebe não vira dona: não fixa, não vira modelo, não apaga; sai quando quiser.

create table public.note_shares (
  note_id uuid not null references public.notes (id) on delete cascade,
  -- Quem recebe
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- A dona da anotação (desnormalizada para a RLS e o sync não precisarem da anotação)
  owner_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'read' check (role in ('read', 'edit')),
  created_at timestamptz not null default now(),
  primary key (note_id, user_id),
  check (user_id <> owner_id)
);
create index note_shares_user on public.note_shares (user_id);
create index note_shares_owner on public.note_shares (owner_id);

alter table public.note_shares enable row level security;
create policy "note_shares_select" on public.note_shares for select to authenticated
  using (user_id = (select auth.uid()) or owner_id = (select auth.uid()));
-- Só pelas RPCs
revoke all on public.note_shares from anon, authenticated;
grant select on public.note_shares to authenticated;

-- A anotação foi compartilhada comigo (p_edit: para editar). Definer: as policies das anotações
-- consultam o compartilhamento sem cair na RLS dele
create function public._note_shared(p_note uuid, p_edit boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.note_shares
    where note_id = p_note and user_id = (select auth.uid()) and (not p_edit or role = 'edit')
  );
$$;
revoke execute on function public._note_shared(uuid, boolean) from public, anon;
grant execute on function public._note_shared(uuid, boolean) to authenticated;

drop policy "notes_select" on public.notes;
create policy "notes_select" on public.notes for select to authenticated
  using ((folder_id is null and (user_id = (select auth.uid()) or public._note_shared(id, false)))
         or (folder_id is not null and public.is_folder_member(folder_id, 'viewer')));
drop policy "notes_update" on public.notes;
create policy "notes_update" on public.notes for update to authenticated
  using ((folder_id is null and (user_id = (select auth.uid()) or public._note_shared(id, true)))
         or (folder_id is not null and public.has_permission(folder_id, 'task.edit', false, user_id = (select auth.uid()))));

-- Quem recebe para editar muda o texto, o título e as propriedades; fixar e virar modelo são da dona
create function public.notes_share_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.folder_id is null and old.user_id is distinct from (select auth.uid())
     and (select auth.uid()) is not null
     and (new.pinned is distinct from old.pinned or new.is_template is distinct from old.is_template) then
    raise exception 'Só a dona da anotação muda isso' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notes_share_guard before update on public.notes
  for each row execute function public.notes_share_guard();

-- Os links de uma anotação compartilhada: quem recebe vê, como a anotação
drop policy "links_select" on public.links;
create policy "links_select" on public.links for select to authenticated
  using ((folder_id is null and (user_id = (select auth.uid())
                                 or (source_kind = 'note' and public._note_shared(source_id, false))))
         or (folder_id is not null and public.is_folder_member(folder_id, 'viewer')));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder',
  'challenge_finished', 'note_shared'));

-- Compartilha (ou muda o papel). Só a dona, só anotação pessoal que não é modelo, só com amigo.
-- Devolve 'added' ou 'updated'
create function public.share_note(p_note uuid, p_user uuid, p_role text default 'read')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.notes;
  v_me uuid := (select auth.uid());
begin
  select * into v_note from public.notes where id = p_note;
  if v_note.id is null or v_note.user_id is distinct from v_me then
    raise exception 'Só quem escreveu a anotação compartilha' using errcode = '42501';
  end if;
  if v_note.folder_id is not null then
    raise exception 'Anotação de pasta: quem vê é quem é da pasta' using errcode = '22023';
  end if;
  if v_note.is_template then
    raise exception 'Modelo não se compartilha' using errcode = '22023';
  end if;
  if p_role not in ('read', 'edit') then
    raise exception 'Papel inválido' using errcode = '22023';
  end if;
  if p_user is null or p_user = v_me or not public.are_friends(v_me, p_user) then
    raise exception 'Só com amigos' using errcode = '42501';
  end if;
  if exists (select 1 from public.note_shares where note_id = p_note and user_id = p_user) then
    update public.note_shares set role = p_role where note_id = p_note and user_id = p_user;
    return 'updated';
  end if;
  if (select count(*) from public.note_shares where note_id = p_note) >= 50 then
    raise exception 'No máximo 50 pessoas por anotação' using errcode = '22023';
  end if;
  insert into public.note_shares (note_id, user_id, owner_id, role)
  values (p_note, p_user, v_me, p_role);
  perform public._notify(p_user, 'note_shared', jsonb_build_object(
    'note_id', p_note, 'title', coalesce(nullif(v_note.title, ''), left(v_note.body, 80)), 'role', p_role));
  return 'added';
end;
$$;
revoke execute on function public.share_note(uuid, uuid, text) from public, anon;
grant execute on function public.share_note(uuid, uuid, text) to authenticated;

-- Para de compartilhar: a dona tira alguém, ou quem recebeu sai (p_user = a própria pessoa)
create function public.unshare_note(p_note uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  delete from public.note_shares
  where note_id = p_note and user_id = p_user and (owner_id = v_me or user_id = v_me);
  if not found then
    raise exception 'Compartilhamento não encontrado' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.unshare_note(uuid, uuid) from public, anon;
grant execute on function public.unshare_note(uuid, uuid) to authenticated;

-- Desfeita a amizade, a anotação deixa de ser compartilhada (nos dois sentidos)
create function public.friendships_note_shares()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.status <> 'accepted' then
    delete from public.note_shares
    where (owner_id = old.user_a and user_id = old.user_b) or (owner_id = old.user_b and user_id = old.user_a);
  end if;
  return null;
end;
$$;
create trigger friendships_note_shares after update or delete on public.friendships
  for each row execute function public.friendships_note_shares();

alter publication powersync add table public.note_shares;
alter publication supabase_realtime add table public.note_shares;

-- Publicar (V11-4): a anotação pessoal (e, se a dona quiser, as anotações pessoais dela ligadas a
-- partir desta) num endereço só de leitura, /p/<token>, aberto para quem não tem conta, com senha
-- opcional. É sempre o texto de agora (não uma cópia); despublicar apaga o endereço.
create table public.note_publications (
  note_id uuid primary key references public.notes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  password_hash text,
  has_password boolean generated always as (password_hash is not null) stored,
  -- Leva junto as anotações pessoais da dona citadas nesta (um nível), com os links entre elas
  include_linked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index note_publications_owner on public.note_publications (owner_id);

alter table public.note_publications enable row level security;
create policy "note_publications_select" on public.note_publications for select to authenticated
  using (owner_id = (select auth.uid()));
-- O hash da senha nem a dona lê; escrever, só pelas RPCs
revoke all on public.note_publications from anon, authenticated;
grant select (note_id, owner_id, token, has_password, include_linked, created_at, updated_at)
  on public.note_publications to authenticated;

-- Senha errada: até 10 tentativas a cada 10 minutos por publicação
create table public.note_publication_failures (
  note_id uuid not null references public.note_publications (note_id) on delete cascade,
  at timestamptz not null default now()
);
create index note_publication_failures_note on public.note_publication_failures (note_id, at);
alter table public.note_publication_failures enable row level security;
revoke all on public.note_publication_failures from anon, authenticated;

-- Publica (ou muda as opções). p_password: null mantém a senha, '' tira, o resto troca.
-- Devolve o token
create function public.publish_note(p_note uuid, p_include_linked boolean default false,
                                    p_password text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.notes;
  v_me uuid := (select auth.uid());
  v_token text;
begin
  select * into v_note from public.notes where id = p_note;
  if v_note.id is null or v_note.user_id is distinct from v_me then
    raise exception 'Só quem escreveu a anotação publica' using errcode = '42501';
  end if;
  if v_note.folder_id is not null then
    raise exception 'Anotação de pasta não se publica' using errcode = '22023';
  end if;
  if v_note.is_template then
    raise exception 'Modelo não se publica' using errcode = '22023';
  end if;
  if p_password is not null and p_password <> '' and char_length(p_password) not between 4 and 72 then
    raise exception 'A senha tem de 4 a 72 caracteres' using errcode = '22023';
  end if;
  insert into public.note_publications (note_id, owner_id, include_linked, password_hash)
  values (p_note, v_me, coalesce(p_include_linked, false),
          case when coalesce(p_password, '') = '' then null
               else extensions.crypt(p_password, extensions.gen_salt('bf', 8)) end)
  on conflict (note_id) do update
  set include_linked = excluded.include_linked,
      password_hash = case when p_password is null then public.note_publications.password_hash
                           else excluded.password_hash end,
      updated_at = now()
  returning token into v_token;
  return v_token;
end;
$$;
revoke execute on function public.publish_note(uuid, boolean, text) from public, anon;
grant execute on function public.publish_note(uuid, boolean, text) to authenticated;

create function public.unpublish_note(p_note uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.note_publications where note_id = p_note and owner_id = (select auth.uid());
end;
$$;
revoke execute on function public.unpublish_note(uuid) from public, anon;
grant execute on function public.unpublish_note(uuid) to authenticated;

-- A página pública. Status: ok, password (pede a senha), wrong, locked (tentativas demais) ou
-- missing (endereço que não existe mais, ou anotação fora do conjunto). Com ok: a anotação pedida
-- (p_note; sem ela, a principal), quem escreveu e as do conjunto (id e título)
create function public.published_note(p_token text, p_password text default null, p_note uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_pub public.note_publications;
  v_set uuid[];
  v_note public.notes;
begin
  select * into v_pub from public.note_publications where token = p_token;
  if v_pub.note_id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_pub.password_hash is not null then
    if coalesce(p_password, '') = '' then
      return jsonb_build_object('status', 'password');
    end if;
    if (select count(*) from public.note_publication_failures
        where note_id = v_pub.note_id and at > now() - interval '10 minutes') >= 10 then
      return jsonb_build_object('status', 'locked');
    end if;
    if extensions.crypt(p_password, v_pub.password_hash) <> v_pub.password_hash then
      insert into public.note_publication_failures (note_id) values (v_pub.note_id);
      return jsonb_build_object('status', 'wrong');
    end if;
  end if;
  v_set := array[v_pub.note_id];
  if v_pub.include_linked then
    v_set := v_set || array(
      select n.id from public.links l join public.notes n on n.id = l.target_id
      where l.source_kind = 'note' and l.source_id = v_pub.note_id and l.target_kind = 'note'
        and n.id <> v_pub.note_id and n.user_id = v_pub.owner_id and n.folder_id is null
        and not n.is_template
      group by n.id order by min(l.position) limit 100);
  end if;
  select * into v_note from public.notes where id = coalesce(p_note, v_pub.note_id) and id = any (v_set);
  if v_note.id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'root', v_pub.note_id,
    'author', (select display_name from public.profiles where id = v_pub.owner_id),
    'note', jsonb_build_object('id', v_note.id, 'title', v_note.title, 'body', v_note.body,
                               'updated_at', v_note.updated_at),
    'notes', (select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', left(n.body, 200))
                               order by array_position(v_set, n.id))
              from public.notes n where n.id = any (v_set)));
end;
$$;
revoke execute on function public.published_note(text, text, uuid) from public;
grant execute on function public.published_note(text, text, uuid) to anon, authenticated;

-- Tentativas erradas velhas não servem para nada (roda junto da limpeza diária das versões)
create function public.purge_note_publication_failures()
returns void
language sql security definer set search_path = ''
as $$ delete from public.note_publication_failures where at < now() - interval '1 day' $$;
revoke execute on function public.purge_note_publication_failures() from public, anon, authenticated;
select cron.schedule('questlist-note-publication-failures', '47 3 * * *',
                     $$select public.purge_note_publication_failures()$$);

-- Exportação (LGPD): os compartilhamentos e as publicações entram
CREATE OR REPLACE FUNCTION public.export_my_data()
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
    -- V10 §4: o que publiquei na comunidade (com a cópia), curtidas e denúncias
    'community_posts', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
                                 from public.community_posts c where c.author_id = v_user), '[]'),
    'community_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'at', l.created_at))
                                 from public.community_likes l where l.user_id = v_user), '[]'),
    'community_reports', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id')
                                   from public.community_reports r where r.user_id = v_user), '[]'),
    -- V6: peso e medidas (dado sensível, AC7) e o consentimento dado para eles
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id' order by b.kind, b.measured_on)
                              from public.body_metrics b where b.user_id = v_user), '[]'),
    'body_goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.body_goals g
                            where g.user_id = v_user), '[]'),
    -- Bem-estar: remédios (dado de saúde, sensível, BE4)
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.created_at)
                             from public.medications m where m.user_id = v_user), '[]'),
    'sensitive_consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.granted_at)
                                    from public.sensitive_consents c where c.user_id = v_user), '[]'),
    -- V6: o diário de treino (AC4)
    'workout_sets', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.performed_at)
                              from public.workout_sets w where w.user_id = v_user), '[]'),
    -- V6: exercícios próprios
    'user_exercises', coalesce((select jsonb_agg(to_jsonb(u) - 'owner_id' order by u.created_at)
                                from public.user_exercises u where u.owner_id = v_user), '[]'),
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
  ) || jsonb_build_object(
    -- V11 (OB11): anotações da pessoa e as versões delas
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notes n
                       where n.user_id = v_user), '[]'),
    'note_versions', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id' order by v.created_at) from public.note_versions v
                               where v.user_id = v_user), '[]'),
    -- OB14: com quem compartilhei (e o que recebi) e o que publiquei (sem o hash da senha)
    'note_shares', coalesce((select jsonb_agg(jsonb_build_object('note_id', s.note_id, 'role', s.role,
                                                                  'mine', s.owner_id = v_user, 'at', s.created_at)
                                              order by s.created_at)
                             from public.note_shares s where s.owner_id = v_user or s.user_id = v_user), '[]'),
    'note_publications', coalesce((select jsonb_agg(to_jsonb(p) - 'owner_id' - 'password_hash' order by p.created_at)
                                   from public.note_publications p where p.owner_id = v_user), '[]')
  );
end;
$function$;

-- Anotação compartilhada e publicada: política de privacidade nova (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-04' $$;
