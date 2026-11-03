-- OB11 (ESCOPO_V11 §8, D296): histórico de versões das anotações. Uma versão por sessão de edição
-- (no máximo uma a cada 10 minutos), feita pelo servidor a cada gravação: guarda o texto de ANTES
-- da gravação quando a última versão tem mais de 10 minutos. Fica 1 ano, só a dona da anotação vê,
-- e o tamanho conta no espaço de anexos (V11-5, D285). Restaurar guarda a de agora antes. A
-- anotação apagada passa pela lixeira (D84) com as versões, e as duas entram na exportação (LGPD).

create table public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  -- A dona da anotação (quem tem o espaço contado), não quem editou
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  props jsonb not null default '{}',
  size integer not null check (size >= 0),
  created_at timestamptz not null default now()
);
create index note_versions_note on public.note_versions (note_id, created_at desc);
create index note_versions_user on public.note_versions (user_id, created_at);

alter table public.note_versions enable row level security;
create policy "note_versions_select" on public.note_versions for select to authenticated
  using (user_id = (select auth.uid()));
-- Apagar uma versão libera espaço (D285); criar e mudar, só o servidor
create policy "note_versions_delete" on public.note_versions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.note_versions from anon, authenticated;
grant select, delete on public.note_versions to authenticated;

-- Espaço usado: anexos das tarefas + versões das anotações (V11-5)
create function public._storage_used(p_user uuid, p_skip_attachment uuid default null)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(size) from public.task_attachments
                   where created_by = p_user and id is distinct from p_skip_attachment), 0)::bigint
       + coalesce((select sum(size) from public.note_versions where user_id = p_user), 0)::bigint;
$$;
revoke execute on function public._storage_used(uuid, uuid) from public, anon, authenticated;

create or replace function public.attachment_usage()
returns bigint
language sql stable security definer set search_path = ''
as $$ select public._storage_used((select auth.uid())); $$;

-- Só as versões (a tela de espaço mostra a parte delas)
create function public.note_versions_usage()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(size), 0)::bigint from public.note_versions where user_id = (select auth.uid());
$$;
revoke execute on function public.note_versions_usage() from public, anon;
grant execute on function public.note_versions_usage() to authenticated;

create or replace function public.task_attachments_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select folder_id into new.folder_id from public.tasks where id = new.task_id;
  if split_part(new.path, '/', 2) <> new.task_id::text
     or (new.thumb_path is not null and split_part(new.thumb_path, '/', 2) <> new.task_id::text) then
    raise exception 'Caminho do anexo não é o da tarefa' using errcode = '22023';
  end if;
  if public._storage_used(coalesce(new.created_by, auth.uid()), new.id) + new.size > 1073741824 then
    raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Guarda uma versão; com o espaço cheio, não guarda (a anotação continua salvando)
create function public._save_note_version(p_note uuid, p_user uuid, p_title text, p_body text, p_props jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_size integer := octet_length(coalesce(p_title, '')) + octet_length(coalesce(p_body, ''))
                    + octet_length(coalesce(p_props, '{}')::text);
begin
  if public._storage_used(p_user) + v_size > 1073741824 then
    return false;
  end if;
  insert into public.note_versions (note_id, user_id, title, body, props, size)
  values (p_note, p_user, coalesce(p_title, ''), coalesce(p_body, ''), coalesce(p_props, '{}'), v_size);
  return true;
end;
$$;
revoke execute on function public._save_note_version(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

create function public.notes_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_last public.note_versions;
begin
  if (old.title, old.body, old.props) is not distinct from (new.title, new.body, new.props) then
    return null;
  end if;
  -- Anotação que acabou de nascer vazia não tem o que guardar
  if old.title = '' and old.body = '' then
    return null;
  end if;
  select * into v_last from public.note_versions
  where note_id = old.id order by created_at desc limit 1;
  if v_last.id is not null and (v_last.created_at > now() - interval '10 minutes'
     or (v_last.title, v_last.body, v_last.props) is not distinct from (old.title, old.body, old.props)) then
    return null;
  end if;
  perform public._save_note_version(old.id, old.user_id, old.title, old.body, old.props);
  return null;
end;
$$;
create trigger notes_version after update of title, body, props on public.notes
  for each row execute function public.notes_version();

-- Restaurar: a de agora vira versão (mesmo dentro dos 10 minutos) e a anotação volta à escolhida
create function public.restore_note_version(p_version uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_version public.note_versions;
  v_note public.notes;
  v_last public.note_versions;
begin
  select * into v_version from public.note_versions
  where id = p_version and user_id = (select auth.uid());
  if v_version.id is null then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;
  select * into v_note from public.notes where id = v_version.note_id;
  if v_note.id is null
     or not ((v_note.folder_id is null and v_note.user_id = (select auth.uid()))
             or (v_note.folder_id is not null
                 and public.has_permission(v_note.folder_id, 'task.edit', false, v_note.user_id = (select auth.uid())))) then
    raise exception 'Sem permissão para mudar esta anotação' using errcode = '42501';
  end if;
  select * into v_last from public.note_versions
  where note_id = v_note.id order by created_at desc limit 1;
  if (v_note.title <> '' or v_note.body <> '')
     and (v_last.id is null
          or (v_last.title, v_last.body, v_last.props) is distinct from (v_note.title, v_note.body, v_note.props)) then
    perform public._save_note_version(v_note.id, v_note.user_id, v_note.title, v_note.body, v_note.props);
  end if;
  update public.notes
  set title = v_version.title, body = v_version.body, props = v_version.props
  where id = v_note.id;
  return jsonb_build_object('title', v_version.title, 'body', v_version.body, 'props', v_version.props);
end;
$$;
revoke execute on function public.restore_note_version(uuid) from public, anon;
grant execute on function public.restore_note_version(uuid) to authenticated;

-- Ficam 1 ano (como o Obsidian Sync)
create function public.purge_note_versions()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.note_versions where created_at < now() - interval '1 year';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_note_versions() from public, anon, authenticated;
select cron.schedule('questlist-note-versions', '41 3 * * *', $$select public.purge_note_versions()$$);

-- Lixeira: a anotação apagada vai com as versões e volta junto
alter table public.deleted_items drop constraint deleted_items_kind_check;
alter table public.deleted_items add constraint deleted_items_kind_check check (kind in (
  'folders', 'folder_members', 'pages', 'tasks', 'task_assignees', 'comments', 'task_attachments',
  'expenses', 'notes', 'note_versions'));

create function public.notes_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(old.folder_id);
begin
  if current_setting('questlist.skip_trash', true) = 'on' then
    return old;
  end if;
  -- Em cascata, a pasta já saiu: a raiz é a do primeiro item da mesma exclusão
  if v_root is null and old.folder_id is not null then
    select coalesce(d.root_folder_id, (d.payload ->> 'id')::uuid) into v_root
    from public.deleted_items d where d.batch = txid_current() order by d.deleted_at, d.id limit 1;
  end if;
  insert into public.deleted_items (kind, row_id, root_folder_id, title, payload)
  values ('notes', old.id::text, v_root, coalesce(nullif(old.title, ''), left(old.body, 80)), to_jsonb(old));
  return old;
end;
$$;
create trigger notes_trash before delete on public.notes
  for each row execute function public.notes_deleted();

-- A versão só vai para a lixeira junto com a anotação (apagar uma versão ou vencer o ano, não)
create function public.note_versions_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid;
begin
  if current_setting('questlist.skip_trash', true) = 'on' then
    return old;
  end if;
  select d.root_folder_id into v_root from public.deleted_items d
  where d.batch = txid_current() and d.kind = 'notes' and d.row_id = old.note_id::text;
  if found then
    insert into public.deleted_items (kind, row_id, root_folder_id, title, payload)
    values ('note_versions', old.id::text, v_root, old.title, to_jsonb(old));
  end if;
  return old;
end;
$$;
create trigger note_versions_trash before delete on public.note_versions
  for each row execute function public.note_versions_deleted();

-- O item principal da exclusão é o de cima (a pasta, a lista, a tarefa, a anotação), não uma versão
create or replace function public.trash_list()
returns table (id uuid, kind text, title text, deleted_at timestamptz, items integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (d.batch) d.id, d.kind, d.title, d.deleted_at,
         (count(*) over (partition by d.batch))::integer
  from public.deleted_items d
  where d.kind <> 'folder_members'
  order by d.batch,
           case d.kind when 'folders' then 0 when 'pages' then 1 when 'tasks' then 2
                       when 'notes' then 2 when 'expenses' then 3 else 9 end,
           d.deleted_at, d.id;
$$;

-- A anotação volta antes das versões
create or replace function public.restore_deleted(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.deleted_items;
  v_row public.deleted_items;
  v_count integer := 0;
begin
  select * into v_item from public.deleted_items where id = p_id;
  if v_item.id is null
     or not (v_item.deleted_by = auth.uid() or public.is_folder_member(v_item.root_folder_id, 'editor')) then
    raise exception 'Item não encontrado na lixeira' using errcode = 'P0002';
  end if;

  for v_row in
    select * from public.deleted_items where batch = v_item.batch
    order by case kind when 'folders' then 0 when 'folder_members' then 1 when 'pages' then 2
                       when 'tasks' then 3 when 'notes' then 3 else 4 end,
             (payload ->> 'parent_id') is not null,
             coalesce((payload ->> 'depth')::int,
                      case when payload ->> 'parent_task_id' is null then 1 else 2 end),
             deleted_at
  loop
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
      v_row.kind, v_row.kind)
    using v_row.payload;
    v_count := v_count + 1;
  end loop;
  delete from public.deleted_items where batch = v_item.batch;
  return v_count;
end;
$$;

-- Restaurar pela fila do aparelho: vai na ordem das gravações (não passa na frente do que foi
-- digitado antes e ainda não subiu)
CREATE OR REPLACE FUNCTION public.run_once(p_key uuid, p_name text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.applied_ops (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'complete_tree' then
      return jsonb_build_object('count', public.complete_tree((p_args ->> 'p_task_id')::uuid));
    when 'start_task' then
      return to_jsonb(public.start_task((p_args ->> 'p_task_id')::uuid,
                                        coalesce((p_args ->> 'p_started')::boolean, true)));
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    when 'log_rep' then
      return public.log_rep((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                            p_args -> 'p_values');
    when 'start_timer' then
      return to_jsonb(public.start_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_kind',
                                         (p_args ->> 'p_started_at')::timestamptz,
                                         (p_args ->> 'p_seconds')::integer,
                                         (p_args ->> 'p_task_id')::uuid,
                                         coalesce(p_args -> 'p_config', '{}'),
                                         p_args ->> 'p_device'));
    when 'update_timer' then
      return to_jsonb(public.update_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_action',
                                          coalesce((p_args ->> 'p_seconds')::integer, 0),
                                          coalesce((p_args ->> 'p_at')::timestamptz, now())));
    when 'log_time' then
      return to_jsonb(public.log_time((p_args ->> 'p_id')::uuid, (p_args ->> 'p_task_id')::uuid,
                                      (p_args ->> 'p_minutes')::integer, (p_args ->> 'p_day')::date,
                                      p_args ->> 'p_note'));
    when 'check_item' then
      return public.check_item((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_done')::boolean,
                               p_args ->> 'p_note');
    when 'log_warmup' then
      return public.log_warmup((p_args ->> 'p_task_id')::uuid, p_args -> 'p_values');
    when 'delete_workout_set' then
      perform public.delete_workout_set((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    when 'delete_time_entry' then
      perform public.delete_time_entry((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    when 'restore_note_version' then
      return public.restore_note_version((p_args ->> 'p_version')::uuid);
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$function$;

-- LGPD: anotações e versões na exportação (a função mais nova era a do 20261180000000)
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
                               where v.user_id = v_user), '[]')
  );
end;
$function$;

-- Versões guardadas por 1 ano: política de privacidade nova (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-03' $$;
