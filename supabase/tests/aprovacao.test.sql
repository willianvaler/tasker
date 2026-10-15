-- V3 §2.8 (M7): só quem aprova conclui a tarefa de aprovação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'editor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'gerente@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Reforma', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'manager');
set local role authenticated;
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title, approver_role, approver_id) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Aprovar orçamento', 'manager', null),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Aprovar cor', null, '22222222-2222-2222-2222-222222222222');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000001') $$, '42501', null,
  'Editor não aprova o que pede Gerente');
select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000002') $$, 'a pessoa definida aprova');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000001') $$, 'o Gerente aprova');
select throws_ok($$ select public.uncomplete_task('c0000000-0000-0000-0000-000000000002') $$, '42501', null,
  'nem reabre a aprovação de outra pessoa');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.uncomplete_task('c0000000-0000-0000-0000-000000000001') $$, 'o Dono reabre a do cargo');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'todo', 'reaberta');
select * from finish();
rollback;
