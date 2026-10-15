-- V3 §4.1 (J1): tarefa com repetições. A conta é de cada pessoa; conclui (com XP) só no total.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranho@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Academia', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');

select throws_ok($$ insert into public.tasks (page_id, title, repeat_plan) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Errado', '{"mode": "sets", "total": 0}') $$,
  '23514', null, 'plano inválido é recusado');

-- Criada pelo lote, com o plano
select lives_ok($$ select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino", "repeat_plan": {"mode": "sets", "total": 3, "rest_seconds": 60}},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Agachamento"}]') $$, 'o lote cria com plano');
select is((select repeat_plan ->> 'total' from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), '3',
  'o plano foi gravado');

select is((public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "40kg"}') ->> 'done_reps')::int, 1, '1ª série');
select is((public.log_rep('c0000000-0000-0000-0000-000000000001', 1) ->> 'done_reps')::int, 2, '2ª série');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'todo',
  'antes do total a tarefa segue aberta');
select ok((public.log_rep('c0000000-0000-0000-0000-000000000001', 1) ? 'xp'), 'a última série conclui, com o resumo de XP');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'done',
  'concluída no total');
select is((select jsonb_array_length(logged_values) from public.task_progress
           where task_id = 'c0000000-0000-0000-0000-000000000001'), 3, 'os valores de cada série ficam guardados');

select is((public.log_rep('c0000000-0000-0000-0000-000000000001', -1) ->> 'done_reps')::int, 2,
  'desfazer a última volta para 2');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'todo',
  'e reabre a tarefa');

select throws_ok($$ select public.log_rep('c0000000-0000-0000-0000-000000000002', 1) $$,
  '22023', 'Esta tarefa não tem repetições', 'sem plano não há série');
select throws_ok($$ insert into public.task_progress (task_id, user_id, done_reps) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 3) $$,
  '42501', null, 'ninguém grava a conta direto');

-- Estranho não vê nem conta; Leitor não conta
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.task_progress), 0, 'estranho não vê a conta dos outros');
select throws_ok($$ select public.log_rep('c0000000-0000-0000-0000-000000000001', 1) $$,
  'P0002', null, 'estranho não registra série');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.log_rep('c0000000-0000-0000-0000-000000000001', 1) $$,
  '42501', null, 'Leitor não registra série');

select * from finish();
rollback;
