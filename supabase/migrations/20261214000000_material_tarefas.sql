-- Ligar o material às tarefas (ES6, ESCOPO_V13 §4, D327). **Pelo código:** o material
-- "NN - M01 - ..." liga sozinho à tarefa cujo título começa com o código ("M01 · Balança...") no
-- mesmo projeto, e "NN - Fase 0 - ..." à lista "Fase 0 · ...". O código é calculado aqui (uma regra
-- só, sem espelho no app). **À mão:** `material_links` guarda a ligação feita pela pessoa
-- (`linked = true`) e a automática que ela desfez (`linked = false`).

-- O código no nome do material: o segundo pedaço de "NN - <código> - ..." (letras e números curtos:
-- M01, P04, CD40, Fase 0, Fase 1A). Sem código, nulo.
create function public.material_code(p_name text)
returns text
language sql immutable set search_path = ''
as $$
  select lower(m[1])
  from regexp_match(p_name, '^\s*\d+\s*-\s*([[:alpha:]]{1,6} ?[0-9]{1,3}[[:alpha:]]?)\s+-\s') m
$$;

-- O código no título da tarefa ou da lista: a primeira palavra antes de " · " ou " - "
create function public.item_code(p_title text)
returns text
language sql immutable set search_path = ''
as $$
  select lower(m[1])
  from regexp_match(p_title, '^\s*([[:alpha:]]{1,6} ?[0-9]{1,3}[[:alpha:]]?)\s+[·-]\s') m
$$;

create table public.material_links (
  material_id uuid not null references public.project_files (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  linked boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (material_id, task_id)
);
create index material_links_task on public.material_links (task_id);
create index material_links_folder on public.material_links (folder_id);

create function public.material_links_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_material_root uuid;
  v_task_root uuid;
begin
  select public.folder_root(folder_id) into v_material_root from public.project_files where id = new.material_id;
  select public.folder_root(folder_id) into v_task_root from public.tasks where id = new.task_id;
  if v_material_root is null or v_material_root is distinct from v_task_root then
    raise exception 'O material e a tarefa não são do mesmo projeto' using errcode = '22023';
  end if;
  new.folder_id := v_material_root;
  return new;
end;
$$;
create trigger material_links_fill before insert or update on public.material_links
  for each row execute function public.material_links_fill();

alter table public.material_links enable row level security;
revoke all on public.material_links from anon;
revoke insert, update on public.material_links from authenticated;
-- O upsert do app (ligar de novo, desfazer a automática) regrava a chave junto: o gatilho confere
grant insert (material_id, task_id, linked), update (material_id, task_id, linked) on public.material_links to authenticated;
create policy "material_links_select" on public.material_links for select to authenticated
  using (public.is_folder_member(folder_id, 'viewer'));
create policy "material_links_insert" on public.material_links for insert to authenticated
  with check (public.has_permission(folder_id, 'task.edit'));
create policy "material_links_update" on public.material_links for update to authenticated
  using (public.has_permission(folder_id, 'task.edit'));
create policy "material_links_delete" on public.material_links for delete to authenticated
  using (public.has_permission(folder_id, 'task.edit'));

-- As ligações do material de um projeto (o de `p_folder`) ou de todos os que a pessoa vê (nulo,
-- para o grafo): pelo código (menos as desfeitas) e à mão. Roda como quem pede (a RLS vale).
create function public.material_task_links(p_folder uuid default null)
returns table (
  material_id uuid,
  material_name text,
  material_folder_id uuid,
  note_id uuid,
  mime text,
  target_kind text,
  target_id uuid,
  target_title text,
  target_folder_id uuid,
  auto boolean
)
language sql stable security invoker set search_path = ''
as $$
  with mats as (
    select pf.id, pf.name, pf.folder_id, pf.note_id, pf.mime, public.folder_root(pf.folder_id) as root,
           public.material_code(pf.name) as code
    from public.project_files pf
    where p_folder is null or public.folder_root(pf.folder_id) = public.folder_root(p_folder)
  ),
  scope as (
    select f.id, coalesce(f.parent_id, f.id) as root from public.folders f
    where coalesce(f.parent_id, f.id) in (select root from mats)
  ),
  by_code as (
    select m.id as material_id, 'task'::text as kind, t.id as target_id, t.title, t.folder_id
    from mats m
    join scope s on s.root = m.root
    join public.tasks t on t.folder_id = s.id and public.item_code(t.title) = m.code
    where m.code is not null
      and not exists (select 1 from public.material_links l
                      where l.material_id = m.id and l.task_id = t.id and not l.linked)
    union all
    select m.id, 'page', p.id, p.name, p.folder_id
    from mats m
    join scope s on s.root = m.root
    join public.pages p on p.folder_id = s.id and public.item_code(p.name) = m.code
    where m.code is not null
  ),
  manual as (
    select l.material_id, 'task'::text as kind, t.id as target_id, t.title, t.folder_id
    from public.material_links l
    join mats m on m.id = l.material_id
    join public.tasks t on t.id = l.task_id
    where l.linked
  )
  select m.id, m.name, m.folder_id, m.note_id, m.mime, x.kind, x.target_id, x.title, x.folder_id,
         bool_or(x.auto)
  from (select *, true as auto from by_code union all select *, false from manual) x
  join mats m on m.id = x.material_id
  group by m.id, m.name, m.folder_id, m.note_id, m.mime, x.kind, x.target_id, x.title, x.folder_id
$$;

revoke execute on function public.material_links_fill() from public, anon, authenticated;
revoke execute on function public.material_task_links(uuid) from public, anon;
grant execute on function public.material_task_links(uuid) to authenticated;
