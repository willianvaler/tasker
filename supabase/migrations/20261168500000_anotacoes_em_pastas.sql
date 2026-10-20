-- Correção do dono (20/10, D236 na main): anotações dentro de pastas e projetos. A anotação ganha
-- a pasta (opcional): sem pasta, continua só da pessoa; numa pasta, quem é da pasta vê, e escreve
-- quem pode criar tarefas ali (o cargo do projeto vale, D74). Apagar: quem escreveu ou quem
-- gerencia páginas.

alter table public.notes add column folder_id uuid references public.folders (id) on delete cascade;
create index notes_folder on public.notes (folder_id, updated_at desc) where folder_id is not null;
grant insert (folder_id) on public.notes to authenticated;

drop policy "notes: as minhas" on public.notes;
create policy "notes_select" on public.notes for select to authenticated
  using ((folder_id is null and user_id = (select auth.uid()))
         or (folder_id is not null and public.is_folder_member(folder_id, 'viewer')));
create policy "notes_insert" on public.notes for insert to authenticated
  with check (user_id = (select auth.uid())
              and (folder_id is null or public.has_permission(folder_id, 'task.create', false, true)));
create policy "notes_update" on public.notes for update to authenticated
  using ((folder_id is null and user_id = (select auth.uid()))
         or (folder_id is not null and public.has_permission(folder_id, 'task.edit', false, user_id = (select auth.uid()))));
create policy "notes_delete" on public.notes for delete to authenticated
  using ((folder_id is null and user_id = (select auth.uid()))
         or (folder_id is not null and (user_id = (select auth.uid()) or public.has_permission(folder_id, 'page.manage', false, false))));

alter publication supabase_realtime add table public.notes;
