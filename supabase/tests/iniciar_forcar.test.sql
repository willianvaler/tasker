-- V3 §2.2 (H3): iniciar, modo estrito e forçar no flexível.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-0000000000ca', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar carvão'),
  ('c0000000-0000-0000-0000-0000000000f0', 'bbbbbbbb-0000-0000-0000-000000000001', 'Acender o fogo');
insert into public.task_dependencies (task_id, depends_on_task_id) values
  ('c0000000-0000-0000-0000-0000000000f0', 'c0000000-0000-0000-0000-0000000000ca');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'contributor');
update public.tasks set created_at = now() - interval '1 hour';
update public.folders set is_shared = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;

-- Estrito: bloqueada não inicia, não conclui e não força
select throws_ok($$ select public.start_task('c0000000-0000-0000-0000-0000000000f0') $$,
  '22023', 'Tarefa bloqueada. Aguardando: Comprar carvão', 'bloqueada não inicia');
select throws_ok($$ select public.complete_task('c0000000-0000-0000-0000-0000000000f0') $$,
  '22023', null, 'bloqueada não conclui');
select throws_ok($$ select public.set_task_status('c0000000-0000-0000-0000-0000000000f0', 'doing') $$,
  '22023', null, 'nem pelo kanban');
select throws_ok($$ select public.force_task('c0000000-0000-0000-0000-0000000000f0', 'complete') $$,
  '42501', null, 'no modo estrito ninguém força');

-- Iniciar: started_at e status juntos
select public.start_task('c0000000-0000-0000-0000-0000000000ca');
select is((select status::text || '/' || (started_at is not null)::text from public.tasks
  where id = 'c0000000-0000-0000-0000-0000000000ca'), 'doing/true', 'iniciar marca em andamento');
select is(public.task_state('c0000000-0000-0000-0000-0000000000ca'), 'doing', 'estado: em andamento');
select public.start_task('c0000000-0000-0000-0000-0000000000ca', false);
select is((select status::text || '/' || (started_at is null)::text from public.tasks
  where id = 'c0000000-0000-0000-0000-0000000000ca'), 'todo/true', 'parar volta para a fazer');

-- Colaborador não inicia o que não é dele
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.start_task('c0000000-0000-0000-0000-0000000000ca') $$,
  '42501', null, 'Colaborador não inicia tarefa de outra pessoa');

-- Flexível: o Dono força, e fica registrado
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.folders set dependency_mode = 'flexible' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select lives_ok($$ select public.force_task('c0000000-0000-0000-0000-0000000000f0', 'complete') $$,
  'no flexível, o Dono força');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-0000000000f0'), 'done',
  'a tarefa forçada fica concluída');
select is((select payload ->> 'action' from public.activity_log where action = 'task_forced'), 'complete',
  'e o forçar fica no registro do projeto');

-- Colaborador não força nem no flexível
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.force_task('c0000000-0000-0000-0000-0000000000f0', 'start') $$,
  '42501', null, 'Colaborador não força');

select * from finish();
rollback;
