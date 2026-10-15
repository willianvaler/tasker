-- V3 §6 (M4): "Meu dia" é de cada um.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Coisas');
insert into public.tasks (id, page_id, title) values ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Lavar');
select lives_ok($$ insert into public.my_day (task_id, day) values ('c0000000-0000-0000-0000-000000000001', '2026-10-15') $$, 'põe no meu dia');
select throws_ok($$ insert into public.my_day (user_id, task_id, day) values ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', '2026-10-15') $$, '42501', null, 'não põe no dia de outra pessoa');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.my_day), 0, 'outra pessoa não vê');
select throws_ok($$ insert into public.my_day (task_id, day) values ('c0000000-0000-0000-0000-000000000001', '2026-10-15') $$, '42501', null, 'nem põe tarefa que não vê');
select * from finish();
rollback;
