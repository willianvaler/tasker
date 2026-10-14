-- D5: conflitos. Campos simples: a última escrita vence (o aparelho só manda o que mudou). Notas:
-- se o texto do servidor mudou desde a versão em que o aparelho se baseou, a versão que perde fica
-- guardada em conflict_copies ("ver versão anterior"). Etiquetas: conjunto, o aparelho manda o que
-- entrou e o que saiu, e não a lista inteira.

create table public.conflict_copies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  field text not null default 'notes' check (field in ('notes')),
  body text not null,
  -- Quem escreveu a versão que ficou (a que substituiu esta)
  replaced_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index conflict_copies_task on public.conflict_copies (task_id);
alter table public.conflict_copies enable row level security;
revoke insert, update on public.conflict_copies from anon, authenticated;

create policy "Membros veem as cópias" on public.conflict_copies
  for select to authenticated using (public.is_folder_member(folder_id));
create policy "Editores descartam as cópias" on public.conflict_copies
  for delete to authenticated using (public.is_folder_member(folder_id, 'editor'));

create function public.set_task_notes(p_task_id uuid, p_notes text, p_base text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if coalesce(v_task.notes, '') <> ''
     and v_task.notes is distinct from p_base
     and v_task.notes is distinct from p_notes then
    insert into public.conflict_copies (task_id, folder_id, body)
    values (v_task.id, v_task.folder_id, v_task.notes);
  end if;
  update public.tasks set notes = nullif(trim(p_notes), '') where id = p_task_id;
end;
$$;

create function public.patch_task_labels(p_task_id uuid, p_add text[], p_remove text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id, 'editor') then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  -- Mantém a ordem de quem já estava; as novas entram no fim (o trigger normaliza)
  update public.tasks
  set labels = array(
    select l from unnest(v_task.labels || coalesce(p_add, '{}')) with ordinality as t (l, o)
    where not l = any (coalesce(p_remove, '{}'))
    group by l order by min(o))
  where id = p_task_id;
end;
$$;

revoke execute on function public.set_task_notes(uuid, text, text) from public, anon;
revoke execute on function public.patch_task_labels(uuid, text[], text[]) from public, anon;
grant execute on function public.set_task_notes(uuid, text, text) to authenticated;
grant execute on function public.patch_task_labels(uuid, text[], text[]) to authenticated;

alter publication powersync add table public.conflict_copies;
