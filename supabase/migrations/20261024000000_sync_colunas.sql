-- D1: colunas de sync nas tabelas sincronizáveis. `version` sobe a cada alteração (o cliente manda
-- a versão em que se baseou quando precisa detectar conflito, como nas notas), `updated_by` diz quem
-- mexeu por último (só informativo, sem FK: a exclusão de conta mexe em tarefas no meio da cascata
-- e a FK travava). Os ids vêm do aparelho (UUID v7); o default do banco fica para o que nasce no
-- servidor.

alter table public.folders
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid default auth.uid(),
  add column version integer not null default 1;

alter table public.pages
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid default auth.uid(),
  add column version integer not null default 1;

alter table public.tasks
  add column updated_by uuid default auth.uid(),
  add column version integer not null default 1;

create function public._sync_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  -- Mudança do servidor (cron, RPC sem usuário) mantém o último autor
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

create trigger folders_sync_touch before update on public.folders
  for each row execute function public._sync_touch();
create trigger pages_sync_touch before update on public.pages
  for each row execute function public._sync_touch();
create trigger tasks_sync_touch before update on public.tasks
  for each row execute function public._sync_touch();
