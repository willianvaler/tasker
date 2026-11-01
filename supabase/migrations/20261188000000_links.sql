-- OB1 (ESCOPO_V11 §1, D286): links [[...]] nas anotações e na descrição das tarefas. A marcação fica
-- no texto (`notes.body`, `tasks.notes`): [[Título|n:<id>]] (n: anotação, t: tarefa, p: lista,
-- f: pasta ou projeto), [[Título#Seção|n:<id>]] com âncora, [[Título]] para o que ainda não existe
-- (ou [[Título|apelido]], como no Obsidian) e ![[...]] para incorporar (OB6). A tabela `links` é
-- refeita por trigger a cada gravação do texto, para os backlinks ("Citado em", OB2) serem uma
-- consulta e não uma busca no texto; entra no sync, para funcionarem sem internet.
-- Espelho do reconhecimento: `src/lib/wikilinks.ts` (os mesmos casos nos dois testes).

create table public.links (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('note', 'task')),
  source_id uuid not null,
  -- Quem escreveu a origem (anotação: a dona; tarefa: quem criou). Sem pasta, só ela vê o link
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- A pasta da origem: com ela, vê quem é da pasta (a mesma regra da anotação e da tarefa)
  folder_id uuid references public.folders (id) on delete cascade,
  -- Sem destino: link para o que ainda não existe ([[Nova ideia]]), pelo título
  target_kind text check (target_kind in ('note', 'task', 'page', 'folder')),
  target_id uuid,
  target_title text not null default '' check (char_length(target_title) <= 200),
  anchor text check (char_length(anchor) <= 200),
  embed boolean not null default false,
  -- A linha em volta do link, sem a marcação (a frase do "Citado em")
  context text not null default '' check (char_length(context) <= 240),
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((target_kind is null) = (target_id is null))
);
create index links_source on public.links (source_kind, source_id);
create index links_target on public.links (target_id) where target_id is not null;
create index links_folder on public.links (folder_id) where folder_id is not null;
create index links_user on public.links (user_id) where folder_id is null;

alter table public.links enable row level security;
create policy "links_select" on public.links for select to authenticated
  using ((folder_id is null and user_id = (select auth.uid()))
         or (folder_id is not null and public.is_folder_member(folder_id, 'viewer')));
-- Só o trigger grava
revoke insert, update, delete on public.links from anon, authenticated;

-- Texto da linha para o "Citado em": os links viram o título e sai o começo de lista, título ou citação
create function public._link_context(p_line text)
returns text
language sql immutable set search_path = ''
as $$
  select left(trim(regexp_replace(
    regexp_replace(p_line, '!?\[\[([^\[\]|#\n]+)(#[^\[\]|\n]+)?(\|[^\[\]\n]*)?\]\]', '\1', 'g'),
    '^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+|>\s*)', '')), 240);
$$;

create function public._refresh_links(p_kind text, p_id uuid, p_user uuid, p_folder uuid, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_line text;
  v_m text[];
  v_pos int := 0;
  v_ref text;
  v_kind text;
  v_id uuid;
begin
  delete from public.links where source_kind = p_kind and source_id = p_id;
  if p_text is null or position('[[' in p_text) = 0 then
    return;
  end if;
  <<lines>>
  foreach v_line in array string_to_array(p_text, E'\n') loop
    continue when position('[[' in v_line) = 0;
    for v_m in
      select regexp_matches(v_line, '(!?)\[\[([^\[\]|#\n]+)(?:#([^\[\]|\n]+))?(?:\|([^\[\]\n]*))?\]\]', 'g')
    loop
      continue when trim(v_m[2]) = '';
      v_pos := v_pos + 1;
      -- Um texto de 20 mil caracteres não precisa de mais que isso
      exit lines when v_pos > 300;
      v_ref := trim(coalesce(v_m[4], ''));
      v_kind := null;
      v_id := null;
      if v_ref ~ '^[ntpf]:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        v_kind := case left(v_ref, 1)
          when 'n' then 'note' when 't' then 'task' when 'p' then 'page' else 'folder' end;
        v_id := substr(v_ref, 3)::uuid;
      end if;
      insert into public.links (source_kind, source_id, user_id, folder_id, target_kind, target_id,
                                target_title, anchor, embed, context, position)
      values (p_kind, p_id, p_user, p_folder, v_kind, v_id, left(trim(v_m[2]), 200),
              left(nullif(trim(coalesce(v_m[3], '')), ''), 200), v_m[1] = '!',
              public._link_context(v_line), v_pos);
    end loop;
  end loop;
end;
$$;

create function public.notes_links()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.links where source_kind = 'note' and source_id = old.id;
    return null;
  end if;
  if tg_op = 'INSERT' and position('[[' in new.body) = 0 then
    return null;
  end if;
  perform public._refresh_links('note', new.id, new.user_id, new.folder_id, new.body);
  return null;
end;
$$;
create trigger notes_links after insert or delete or update of body, folder_id on public.notes
  for each row execute function public.notes_links();

create function public.tasks_links()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.links where source_kind = 'task' and source_id = old.id;
    return null;
  end if;
  -- Quase toda tarefa nasce sem link: não paga nada
  if tg_op = 'INSERT' and position('[[' in coalesce(new.notes, '')) = 0 then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes
     and position('[[' in coalesce(new.notes, '')) = 0 then
    return null;
  end if;
  perform public._refresh_links('task', new.id, new.created_by, new.folder_id, new.notes);
  return null;
end;
$$;
create trigger tasks_links after insert or delete or update of notes, folder_id on public.tasks
  for each row execute function public.tasks_links();

revoke execute on function public._refresh_links(text, uuid, uuid, uuid, text) from public, anon, authenticated;

-- O que já foi escrito com [[ ]] antes desta migração
select public._refresh_links('note', id, user_id, folder_id, body) from public.notes where body like '%[[%';
select public._refresh_links('task', id, created_by, folder_id, notes) from public.tasks where notes like '%[[%';

alter publication powersync add table public.links;
alter publication supabase_realtime add table public.links;
