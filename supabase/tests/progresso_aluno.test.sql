-- V3 §3 (L2): progresso por aluno na página ao vivo. Cada um marca o seu, por ciclo; a tarefa do
-- autor não muda; o outro aluno não vê; o autor acompanha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna.a@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'aluno.b@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');
insert into public.tasks (id, page_id, title, repeat_plan) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Alongar', null),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', '{"mode": "sets", "total": 2}');
reset role;
insert into public.page_shares (page_id, owner_id, recipient_id, mode, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'live', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'live', 'active');
set local role authenticated;

-- Aluna A marca o Alongar (com observação) e faz as 2 séries do Supino
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.check_item('c0000000-0000-0000-0000-000000000001', true, 'senti o ombro') $$,
  'a aluna marca um item');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'todo',
  'a tarefa do treinador não muda');
select is((public.log_rep('c0000000-0000-0000-0000-000000000002', 1, '{"weight": "20kg"}') ->> 'done_reps')::int, 1,
  'a aluna registra uma série');
select is((public.log_rep('c0000000-0000-0000-0000-000000000002', 1, '{"weight": "22kg"}') ->> 'completed')::boolean, true,
  'a última série marca o item dela');
select is((select count(*)::int from public.share_checks), 2, 'dois itens marcados por ela');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 'todo',
  'o Supino do treinador segue aberto');
select is((public.log_rep('c0000000-0000-0000-0000-000000000002', -1) ->> 'completed')::boolean, false,
  'desfazer a última desmarca o item dela');

-- Aluno B não vê nada da A
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.share_checks), 0, 'o outro aluno não vê as marcações da A');
select is((select count(*)::int from public.task_progress), 0, 'nem as cargas dela');

-- O treinador acompanha
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select note from public.share_checks where task_id = 'c0000000-0000-0000-0000-000000000001'), 'senti o ombro',
  'o treinador vê a marcação e a observação');
select is((select jsonb_array_length(logged_values) from public.task_progress
           where task_id = 'c0000000-0000-0000-0000-000000000002'), 1, 'e as cargas registradas');

select is((select cycle_key from public.share_checks limit 1), public.page_cycle_key('bbbbbbbb-0000-0000-0000-000000000001'),
  'a marcação é do ciclo da página (semana)');

-- Estranho não marca
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$ select public.check_item('c0000000-0000-0000-0000-000000000001', true) $$, 'P0002', null,
  'estranho não marca');

select * from finish();
rollback;
