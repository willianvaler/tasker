-- V3 §2.4 (I7): vínculos "Relacionados" entre tarefas, listas e projetos/pastas. Só informam: não
-- mexem em estado nem em permissão. Quem vê o vínculo só vê o título do outro lado se tiver acesso
-- a ele (item_relations devolve o título vazio). Ligações valem nos dois sentidos.

create table public.relations (
  id uuid primary key default gen_random_uuid(),
  from_type text not null check (from_type in ('task', 'page', 'folder')),
  from_id uuid not null,
  to_type text not null check (to_type in ('task', 'page', 'folder')),
  to_id uuid not null,
  kind text not null default 'related' check (kind = 'related'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (from_type, from_id, to_type, to_id),
  check (not (from_type = to_type and from_id = to_id))
);
create index relations_from on public.relations (from_type, from_id);
create index relations_to on public.relations (to_type, to_id);

-- Pasta de um item (tarefa, lista ou pasta)
create function public._item_folder(p_type text, p_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'task' then (select folder_id from public.tasks where id = p_id)
    when 'page' then (select folder_id from public.pages where id = p_id)
    when 'folder' then (select id from public.folders where id = p_id)
  end;
$$;

-- O usuário vê o que está nesta pasta? (membro do projeto, ou dono da pasta pessoal)
create function public._can_view_folder(p_folder uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_folder is not null and (
    public.is_folder_member(p_folder)
    or exists (select 1 from public.folders where id = public.folder_root(p_folder) and owner_id = auth.uid()));
$$;

-- Pode mexer nos vínculos deste item? (editar tarefa no projeto; na pasta pessoal, o dono)
create function public._can_relate(p_folder uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_folder is not null and (
    public.has_permission(p_folder, 'task.edit')
    or exists (select 1 from public.folders where id = public.folder_root(p_folder) and owner_id = auth.uid()));
$$;

alter table public.relations enable row level security;

create policy "relations_select" on public.relations for select to authenticated
  using (public._can_view_folder(public._item_folder(from_type, from_id))
      or public._can_view_folder(public._item_folder(to_type, to_id)));
-- Ligar: ver os dois lados e poder editar o de origem
create policy "relations_insert" on public.relations for insert to authenticated
  with check (public._can_relate(public._item_folder(from_type, from_id))
          and public._can_view_folder(public._item_folder(to_type, to_id)));
-- Desligar: quem ligou, ou quem edita qualquer um dos lados
create policy "relations_delete" on public.relations for delete to authenticated
  using (created_by = auth.uid()
      or public._can_relate(public._item_folder(from_type, from_id))
      or public._can_relate(public._item_folder(to_type, to_id)));

revoke all on public.relations from anon, authenticated;
grant select, delete on public.relations to authenticated;
grant insert (id, from_type, from_id, to_type, to_id) on public.relations to authenticated;

-- Os vínculos de um item, nos dois sentidos, com o título só para quem tem acesso
create function public.item_relations(p_type text, p_id uuid)
returns table (id uuid, other_type text, other_id uuid, title text, icon text, can_unlink boolean)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select r.id, r.to_type as other_type, r.to_id as other_id, r.created_by
    from public.relations r where r.from_type = p_type and r.from_id = p_id
    union all
    select r.id, r.from_type, r.from_id, r.created_by
    from public.relations r where r.to_type = p_type and r.to_id = p_id
  )
  select m.id, m.other_type, m.other_id,
    case when public._can_view_folder(public._item_folder(m.other_type, m.other_id)) then
      case m.other_type
        when 'task' then (select t.title from public.tasks t where t.id = m.other_id)
        when 'page' then (select pg.name from public.pages pg where pg.id = m.other_id)
        else (select f.name from public.folders f where f.id = m.other_id)
      end
    end,
    case when public._can_view_folder(public._item_folder(m.other_type, m.other_id)) then
      case m.other_type
        when 'page' then (select pg.icon from public.pages pg where pg.id = m.other_id)
        when 'folder' then (select f.icon from public.folders f where f.id = m.other_id)
      end
    end,
    m.created_by = auth.uid()
      or public._can_relate(public._item_folder(p_type, p_id))
      or public._can_relate(public._item_folder(m.other_type, m.other_id))
  from mine m
  -- Quem não vê o item de partida não vê nada
  where public._can_view_folder(public._item_folder(p_type, p_id));
$$;

-- Busca para ligar: tarefas, listas e pastas que o usuário vê, pelo título
create function public.relation_candidates(p_query text)
returns table (type text, id uuid, title text, context text)
language sql stable security definer set search_path = ''
as $$
  (select 'folder', f.id, f.name, null::text
   from public.folders f
   where f.parent_id is null and not f.is_inbox and public._can_view_folder(f.id)
     and f.name ilike '%' || p_query || '%'
   order by f.name limit 5)
  union all
  (select 'page', pg.id, pg.name, f.name
   from public.pages pg join public.folders f on f.id = pg.folder_id
   where public._can_view_folder(pg.folder_id) and pg.name ilike '%' || p_query || '%'
   order by pg.name limit 8)
  union all
  (select 'task', t.id, t.title, pg.name
   from public.tasks t join public.pages pg on pg.id = t.page_id
   where public._can_view_folder(t.folder_id) and t.title ilike '%' || p_query || '%'
   order by t.status = 'done', t.title limit 12);
$$;

grant execute on function public.item_relations(text, uuid) to authenticated;
grant execute on function public.relation_candidates(text) to authenticated;
revoke execute on function public._item_folder(text, uuid) from public, anon;
revoke execute on function public._can_view_folder(uuid) from public, anon;
revoke execute on function public._can_relate(uuid) from public, anon;
grant execute on function public._item_folder(text, uuid) to authenticated;
grant execute on function public._can_view_folder(uuid) to authenticated;
grant execute on function public._can_relate(uuid) to authenticated;

-- Item apagado leva os vínculos junto
create function public.drop_relations()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
begin
  delete from public.relations
  where (from_type = v_type and from_id = old.id) or (to_type = v_type and to_id = old.id);
  return null;
end;
$$;

create trigger tasks_drop_relations after delete on public.tasks
  for each row execute function public.drop_relations('task');
create trigger pages_drop_relations after delete on public.pages
  for each row execute function public.drop_relations('page');
create trigger folders_drop_relations after delete on public.folders
  for each row execute function public.drop_relations('folder');
