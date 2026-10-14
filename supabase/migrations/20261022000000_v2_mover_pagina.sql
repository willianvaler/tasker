-- C3 (V2 §5.3, "Mover para…"): mover a página de pasta não funcionava pelo app. A trigger que leva
-- o folder_id para as tarefas rodava como o usuário, e o usuário não grava tasks.folder_id
-- (privilégio por coluna, D7). Passa a rodar como dona da função; a permissão de mover continua na
-- policy de pages (editor na pasta de origem e na de destino).

create or replace function public.pages_after_move()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tasks set folder_id = new.folder_id where page_id = new.id;
  return null;
end;
$$;

revoke execute on function public.pages_after_move() from public, anon, authenticated;
