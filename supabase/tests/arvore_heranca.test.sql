-- V3 §1.2 (G3): herança de etiquetas e responsáveis; estimativa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Mudança', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plano');
insert into public.tasks (id, page_id, title, labels) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Cozinha', array['casa']);
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Louça');
insert into public.tasks (id, page_id, parent_task_id, title, labels) values
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Panelas', array['frágil']);
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Copos');
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111');
-- A herança de responsáveis roda no fim da transação
set constraints all immediate;

select is((select labels from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), array['casa'],
  'subtarefa sem etiqueta herda as da mãe');
select is((select labels from public.tasks where id = 'c0000000-0000-0000-0000-000000000003'), array['frágil'],
  'quem já tem etiqueta fica com a sua');
select is((select user_id::text from public.task_assignees where task_id = 'c0000000-0000-0000-0000-000000000002'),
  '22222222-2222-2222-2222-222222222222', 'subtarefa sem responsável herda o da mãe');
select is((select array_agg(user_id::text) from public.task_assignees where task_id = 'c0000000-0000-0000-0000-000000000004'),
  array['11111111-1111-1111-1111-111111111111'], 'quem já tem responsável fica com o seu');

select lives_ok($$ update public.tasks set estimate_minutes = 90 where id = 'c0000000-0000-0000-0000-000000000002' $$,
  'estimativa em minutos');
select throws_ok($$ update public.tasks set estimate_minutes = 0 where id = 'c0000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'estimativa precisa ser positiva');

select * from finish();
rollback;
