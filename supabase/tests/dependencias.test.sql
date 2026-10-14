-- V3 §2.1 (H1): dependências, mesmo projeto e ciclo com o caminho na mensagem.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Outro', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Outra');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar carvão'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Acender o fogo'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assar a carne'),
  ('c0000000-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000002', 'De outro projeto');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

select lives_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
     ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002') $$,
  'fogo depende do carvão; carne depende do fogo');
select is((select folder_id::text from public.task_dependencies limit 1), 'aaaaaaaa-0000-0000-0000-000000000001',
  'pasta preenchida pelo banco');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003') $$,
  '22023', 'Isso criaria um ciclo: Comprar carvão → Assar a carne → Acender o fogo → Comprar carvão',
  'ciclo indireto recusado com o caminho');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$,
  '22023', 'Isso criaria um ciclo: Comprar carvão → Comprar carvão', 'sem depender de si mesma');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009') $$,
  '22023', 'Dependências só entre tarefas do mesmo projeto', 'só no mesmo projeto');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001') $$,
  '23505', null, 'a mesma ligação não se repete');

-- Leitor vê, mas não liga
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.task_dependencies), 2, 'Leitor vê as dependências');
select throws_ok(
  $$ insert into public.task_dependencies (task_id, depends_on_task_id) values
     ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Leitor não cria dependência');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.tasks where id = 'c0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.task_dependencies), 0, 'apagar a tarefa leva as ligações');

select * from finish();
rollback;
