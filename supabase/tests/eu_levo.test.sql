-- V3 §6 (M2): "eu levo" — a pessoa se coloca numa tarefa sem responsável; só a si, só se vaga.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'colab@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'outro@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'contributor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carvão');

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$ insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444') $$, '42501', null, 'Leitor não leva');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$, '42501', null,
  'Colaborador não coloca outra pessoa');
select lives_ok($$ insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$, 'Colaborador leva a tarefa vaga');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$, '42501', null,
  'quem chega depois não leva (já tem responsável)');
select is((select count(*)::int from public.task_assignees), 1, 'um responsável só');

select * from finish();
rollback;
