-- PC2 (D307): dependência entre projetos. Ana edita na Obra e no Mercado; Bia é só da Obra; Caio é
-- só leitor do Mercado (e editor da Obra).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Obra', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Mercado', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Etapas'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assentar piso'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Rejuntar'),
  ('c0000000-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000002', 'Comprar piso'),
  ('c0000000-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000002', 'Comprar rejunte');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'viewer');
set local role authenticated;

select lives_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009') $$,
  'quem edita nos dois liga o piso da obra à compra do mercado');
select is((select folder_id::text from public.task_dependencies), 'aaaaaaaa-0000-0000-0000-000000000001',
  'a ligação mora no projeto da tarefa que espera');
select is(public.task_state('c0000000-0000-0000-0000-000000000001'), 'blocked', 'o piso espera a compra');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001') $$,
  '22023', null, 'ciclo entre projetos também é recusado');

-- Bia (só da Obra): vê o pré-requisito pelo cross_project_links, sem o nome do outro projeto
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where id = 'c0000000-0000-0000-0000-000000000009'), 0,
  'Bia não lê as tarefas do Mercado');
select is(public.cross_project_links('aaaaaaaa-0000-0000-0000-000000000001') -> 'prereqs',
  '[{"id": "c0000000-0000-0000-0000-000000000009", "title": "Comprar piso", "status": "todo", "project": null,
     "deps_mode": "all", "started_at": null, "completed_at": null}]'::jsonb,
  'Bia vê título e estado do pré-requisito, sem o projeto');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000008') $$,
  '42501', null, 'Bia não liga a uma tarefa de projeto em que não está');
select throws_ok($$ select public.cross_project_links('aaaaaaaa-0000-0000-0000-000000000002') $$,
  'P0002', null, 'nem lê as ligações do Mercado');

-- Caio: leitor do Mercado não expõe as tarefas de lá
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000008') $$,
  '42501', null, 'leitor do outro projeto não liga');
select is(public.cross_project_links('aaaaaaaa-0000-0000-0000-000000000002') -> 'dependents' -> 0 ->> 'project', 'Obra',
  'do lado do Mercado, quem é dos dois vê o projeto que espera');

-- Ana conclui a compra: o piso fica pronto
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task('c0000000-0000-0000-0000-000000000009');
select is(public.task_state('c0000000-0000-0000-0000-000000000001'), 'ready', 'compra feita libera o piso');
select is(public.cross_project_links('aaaaaaaa-0000-0000-0000-000000000001') -> 'prereqs' -> 0 ->> 'project', 'Mercado',
  'Ana, que é do Mercado, vê o nome do projeto');

select * from finish();
rollback;
