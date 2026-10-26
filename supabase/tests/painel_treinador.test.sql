-- V6 AC13: painel do treinador. Quem acompanha a página lê o diário do aluno só naquela página.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');
insert into public.tasks (id, page_id, title, repeat_plan) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', '{"mode": "sets", "total": 3}');
reset role;
insert into public.page_shares (id, page_id, owner_id, recipient_id, mode, status, accepted_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'live', 'active', now());
set local role authenticated;

-- A aluna treina a página e também tem um treino só dela
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "20kg", "reps": 10}');
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "22kg", "reps": 8}');
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Meu treino');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Treino B', 'cards');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002',
  '[{"id": "c0000000-0000-0000-0000-000000000002", "title": "Remada", "repeat_plan": {"mode": "sets", "total": 3}}]');
select public.log_rep('c0000000-0000-0000-0000-000000000002', 1, '{"weight": "30kg", "reps": 10}');
select throws_ok($$ select * from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222') $$, 'P0002', null, 'a aluna não abre o painel');

-- O treinador lê as séries da página, e só as dela
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222')), 2, 'treinador lê as séries da aluna nesta página');
select is((select max(weight_kg) from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222')), 22.00::numeric, 'com a carga de cada série');
select ok(not exists (select 1 from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222') where exercise_name = 'Remada'), 'o treino só dela fica de fora');
select is((select count(*)::int from public.workout_sets), 0, 'direto na tabela, nada');
select throws_ok($$ select * from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333') $$, 'P0002', null, 'quem não recebeu a página não é aluno');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select * from public.student_workout_sets('bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222') $$, 'P0002', null, 'estranho não lê');

select * from finish();
rollback;
