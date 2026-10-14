-- V2 §5: Pasta (organizar) e Projeto (objetivo com pessoas) são tipos diferentes do mesmo container.
-- Projeto só na raiz; compartilhar uma pasta a transforma em projeto (quem convida quer um objetivo
-- em grupo), e projeto compartilhado não volta a ser pasta. Os de hoje (pastas compartilhadas) viram
-- projeto.

alter table public.folders
  add column kind text not null default 'folder' check (kind in ('folder', 'project'));

alter table public.folders
  add constraint folders_project_is_root check (kind = 'folder' or parent_id is null);

update public.folders set kind = 'project' where is_shared and parent_id is null;

create function public.folders_shared_is_project()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.is_shared and new.parent_id is null then
    new.kind := 'project';
  end if;
  return new;
end;
$$;

create trigger folders_shared_is_project
  before insert or update of is_shared, kind on public.folders
  for each row execute function public.folders_shared_is_project();

grant insert (kind) on public.folders to authenticated;
grant update (kind) on public.folders to authenticated;
