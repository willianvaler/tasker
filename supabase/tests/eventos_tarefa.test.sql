-- V3 §2.7 (I1): task_events, só inserção, gravado por trigger; ver pede workflow.view_audit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'greg@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'colab@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Preparo');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-0000000000ca', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar carvão'),
  ('c0000000-0000-0000-0000-0000000000f0', 'bbbbbbbb-0000-0000-0000-000000000001', 'Acender o fogo');

select is((select count(*)::int from public.task_events where kind = 'created'), 2, 'criar grava "created"');

insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-0000000000ca', '22222222-2222-2222-2222-222222222222');
select is((select payload ->> 'name' from public.task_events where kind = 'assigned'), 'greg',
  'atribuir grava quem');

insert into public.task_dependencies (task_id, depends_on_task_id) values
  ('c0000000-0000-0000-0000-0000000000f0', 'c0000000-0000-0000-0000-0000000000ca');
select is((select payload ->> 'prereq' from public.task_events where kind = 'dependency_added'), 'Comprar carvão',
  'ligar grava o pré-requisito');
select is((select count(*)::int from public.task_events where kind = 'blocked'
  and task_id = 'c0000000-0000-0000-0000-0000000000f0'), 1, 'a tarefa passou a esperar');

-- O Greg conclui o carvão: o fogo fica pronto
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task('c0000000-0000-0000-0000-0000000000ca');
select is((select user_id from public.task_events where kind = 'completed'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'concluir grava quem concluiu');
select is((select count(*)::int from public.task_events where kind = 'ready'
  and task_id = 'c0000000-0000-0000-0000-0000000000f0'), 1, 'o dependente fica pronto');

select public.start_task('c0000000-0000-0000-0000-0000000000f0');
select is((select count(*)::int from public.task_events where kind = 'started'), 1, 'iniciar grava "started"');

select public.uncomplete_task('c0000000-0000-0000-0000-0000000000ca');
select is((select count(*)::int from public.task_events where kind = 'reopened'), 1, 'reabrir grava "reopened"');
select is((select count(*)::int from public.task_events where kind = 'blocked'
  and task_id = 'c0000000-0000-0000-0000-0000000000f0'), 2, 'e o dependente volta a esperar');

update public.tasks set title = 'Acender a churrasqueira', page_id = 'bbbbbbbb-0000-0000-0000-000000000002'
where id = 'c0000000-0000-0000-0000-0000000000f0';
select is((select payload ->> 'from' from public.task_events where kind = 'renamed'), 'Acender o fogo',
  'renomear grava o nome antigo');
select is((select payload ->> 'to' from public.task_events where kind = 'moved'), 'Preparo',
  'mover grava a página nova');

delete from public.tasks where id = 'c0000000-0000-0000-0000-0000000000f0';
select is((select payload ->> 'title' from public.task_events where kind = 'deleted'), 'Acender a churrasqueira',
  'apagar grava, e o histórico fica');

-- Ver: Editor sim; Colaborador e estranho não
select ok((select count(*) from public.task_events) > 0, 'Editor vê a auditoria');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.task_events), 0, 'Colaborador não vê');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.task_events), 0, 'estranho não vê');

-- Só inserção, e só pelo servidor
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ delete from public.task_events $$, '42501', null, 'ninguém apaga o histórico');

select * from finish();
rollback;
