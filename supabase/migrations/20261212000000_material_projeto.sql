-- Material do projeto (ES4, ESCOPO_V13 §3, D325). A lista dos arquivos de estudo de uma pasta ou
-- projeto, na ordem do nome. Cada material é um PDF guardado no Storage (bucket privado
-- `materials`, 50 MB por arquivo, V13-4) ou uma anotação da pasta (o `.md` que entrou como
-- material). Quem vê a pasta lê; quem tem `page.manage` acrescenta e tira. Conta no mesmo 1 GB por
-- conta. Tirar o material vai para a lixeira (e a anotação, se for uma, continua nas Anotações).

-- Bucket próprio: o dos anexos tem 10 MB por arquivo. Só PDF por enquanto (o HTML interativo do ES5
-- entra aqui também, guardado como texto, nunca servido como página do app)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.project_files (
  id uuid primary key,
  folder_id uuid not null references public.folders (id) on delete cascade,
  kind text not null check (kind in ('file', 'note')),
  note_id uuid references public.notes (id) on delete cascade,
  path text unique,
  name text not null check (char_length(name) between 1 and 200),
  mime text check (char_length(mime) <= 100),
  size bigint check (size between 1 and 52428800),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_files_shape check (
    (kind = 'file' and path is not null and size is not null and mime = 'application/pdf' and note_id is null)
    or (kind = 'note' and note_id is not null and path is null and size is null))
);
create index project_files_folder on public.project_files (folder_id);
create index project_files_note on public.project_files (note_id);
create index project_files_owner on public.project_files (created_by);
create unique index project_files_one_note on public.project_files (folder_id, note_id) where note_id is not null;

alter table public.project_files enable row level security;
revoke all on public.project_files from anon;
revoke insert, update on public.project_files from authenticated;
grant insert (id, folder_id, kind, note_id, path, name, mime, size) on public.project_files to authenticated;
create policy "project_files_select" on public.project_files for select to authenticated
  using (public.is_folder_member(folder_id, 'viewer'));
create policy "project_files_insert" on public.project_files for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_permission(folder_id, 'page.manage'));
create policy "project_files_delete" on public.project_files for delete to authenticated
  using (public.has_permission(folder_id, 'page.manage'));

-- Espaço usado: anexos + versões e imagens das anotações + material (1 GB por conta)
create or replace function public._storage_used(p_user uuid, p_skip_attachment uuid default null)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(size) from public.task_attachments
                   where created_by = p_user and id is distinct from p_skip_attachment), 0)::bigint
       + coalesce((select sum(size) from public.note_versions where user_id = p_user), 0)::bigint
       + coalesce((select sum(size) from public.note_assets
                   where user_id = p_user and id is distinct from p_skip_attachment), 0)::bigint
       + coalesce((select sum(size) from public.project_files
                   where created_by = p_user and id is distinct from p_skip_attachment), 0)::bigint;
$$;

-- O uso separado, para a tela de Dados (V13-4: "o Perfil mostra o uso separado")
create function public.storage_usage()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'attachments', coalesce((select sum(size) from public.task_attachments where created_by = (select auth.uid())), 0),
    'note_versions', coalesce((select sum(size) from public.note_versions where user_id = (select auth.uid())), 0),
    'note_images', coalesce((select sum(size) from public.note_assets where user_id = (select auth.uid())), 0),
    'materials', coalesce((select sum(size) from public.project_files where created_by = (select auth.uid())), 0));
$$;
revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

create function public.project_files_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'file' then
    -- O caminho é o da pasta ("<pasta>/<id>.pdf"), para a RLS do Storage valer
    if new.path !~ ('^' || new.folder_id::text || '/' || new.id::text || '\.pdf$') then
      raise exception 'Caminho do material não é o da pasta' using errcode = '22023';
    end if;
    if public._storage_used(new.created_by, new.id) + new.size > 1073741824 then
      raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
    end if;
  elsif not exists (select 1 from public.notes n where n.id = new.note_id and n.folder_id = new.folder_id) then
    raise exception 'A anotação não é desta pasta' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger project_files_fill before insert on public.project_files
  for each row execute function public.project_files_fill();

-- A fila de apagar do Storage passa a saber o bucket (até aqui, sempre o dos anexos)
alter table public.storage_garbage add column bucket text not null default 'attachments';

create or replace function public.flush_storage_garbage()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'storage_url');
  v_key text := (select value from public.app_config where key = 'storage_key');
  v_bucket text;
  v_paths text[];
  v_count integer := 0;
begin
  if v_url is null or v_key is null then
    return 0;
  end if;
  for v_bucket in select distinct bucket from public.storage_garbage loop
    select array_agg(path) into v_paths
    from (select path from public.storage_garbage where bucket = v_bucket order by queued_at limit 100) g;
    perform net.http_delete(
      url := v_url || '/object/' || v_bucket,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'apikey', v_key,
                                    'Content-Type', 'application/json'),
      body := jsonb_build_object('prefixes', to_jsonb(v_paths)));
    delete from public.storage_garbage where bucket = v_bucket and path = any (v_paths);
    v_count := v_count + coalesce(array_length(v_paths, 1), 0);
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.flush_storage_garbage() from public, anon, authenticated;

-- Lixeira: como o resto da pasta (volta junto com ela, ou sozinho); sem lixeira (excluir a conta),
-- o arquivo vai direto para a fila de apagar
alter table public.deleted_items drop constraint deleted_items_kind_check;
alter table public.deleted_items add constraint deleted_items_kind_check check (kind in (
  'folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments', 'task_attachments',
  'expenses', 'notes', 'note_versions', 'note_assets', 'project_files'));

create trigger project_files_trash before delete on public.project_files
  for each row execute function public._trash_row();

create function public.project_files_garbage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.path is not null and current_setting('questlist.skip_trash', true) = 'on' then
    insert into public.storage_garbage (bucket, path) values ('materials', old.path) on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger project_files_garbage before delete on public.project_files
  for each row execute function public.project_files_garbage();

-- A lixeira vence: os arquivos dela vão para a fila de apagar (cada um no seu bucket)
create or replace function public.purge_trash()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.storage_garbage (path)
  select p from public.deleted_items d,
    unnest(array[d.payload ->> 'path', d.payload ->> 'thumb_path']) p
  where d.kind in ('task_attachments', 'note_assets') and d.deleted_at < now() - interval '30 days'
    and p is not null
  on conflict do nothing;
  insert into public.storage_garbage (bucket, path)
  select 'materials', d.payload ->> 'path' from public.deleted_items d
  where d.kind = 'project_files' and d.deleted_at < now() - interval '30 days'
    and d.payload ->> 'path' is not null
  on conflict do nothing;
  delete from public.deleted_items where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Storage: a primeira parte do caminho é a pasta
create policy "materials: ler" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.is_folder_member((storage.foldername(name))[1]::uuid, 'viewer'));
create policy "materials: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.has_permission((storage.foldername(name))[1]::uuid, 'page.manage'));
create policy "materials: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.has_permission((storage.foldername(name))[1]::uuid, 'page.manage'));

revoke execute on function public.project_files_fill(), public.project_files_garbage() from public, anon, authenticated;

-- A política muda (material de estudo que a pessoa envia): todo mundo aceita de novo
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-22' $$;

-- Exportar meus dados leva a lista do material e a das imagens das anotações
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
                                   from public.note_publications p where p.owner_id = v_user), '[]'),
    -- V12 (AG1): a disponibilidade da agenda
    'availability_rules', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.weekday, r.starts)
                                    from public.availability_rules r where r.user_id = v_user), '[]'),
    'availability_exceptions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.starts_on)
                                         from public.availability_exceptions x where x.user_id = v_user), '[]'),
    -- AG2: tipos de compromisso e as reservas feitas comigo (com os dados de quem reservou)
    'booking_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at)
                               from public.booking_types t where t.user_id = v_user), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'owner_id' - 'token' order by b.starts_at)
                          from public.bookings b where b.owner_id = v_user), '[]'),
    'time_polls', coalesce((select jsonb_agg(to_jsonb(tp) - 'owner_id' - 'token' || jsonb_build_object(
        'slots', coalesce((select jsonb_agg(s.starts_at order by s.starts_at)
                           from public.time_poll_slots s where s.poll_id = tp.id), '[]'),
        'votes', coalesce((select jsonb_agg(jsonb_build_object('name', v.name, 'email', v.email,
                             'slots', (select coalesce(jsonb_agg(s.starts_at order by s.starts_at), '[]')
                                       from public.time_poll_slots s where s.id = any (v.slots)))
                           order by v.created_at)
                           from public.time_poll_votes v where v.poll_id = tp.id), '[]'))
        order by tp.created_at)
                            from public.time_polls tp where tp.owner_id = v_user), '[]')
  ) || jsonb_build_object(
    'project_files', coalesce((select jsonb_agg(to_jsonb(pf) - 'created_by' order by pf.created_at)
                               from public.project_files pf where pf.created_by = v_user), '[]'),
    'note_images', coalesce((select jsonb_agg(to_jsonb(na) - 'user_id' order by na.created_at)
                             from public.note_assets na where na.user_id = v_user), '[]')
  );
end;
$function$;
