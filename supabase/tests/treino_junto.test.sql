-- V6 AC10.1: treinar junto. Série vale para o grupo; quem marca a última conclui (XP dele).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Treino da dupla', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino", "repeat_plan": {"mode": "sets", "total": 2}},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Prancha"}]');
reset role;
-- Criada há tempo (concluir logo depois de criar vale 0 XP)
update public.tasks set created_at = now() - interval '1 hour' where page_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;

select throws_ok($$ select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001',
  array['33333333-3333-3333-3333-333333333333'::uuid]) $$, '22023', null, 'estranho não entra no treino');

create temp table s as select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001',
  array['22222222-2222-2222-2222-222222222222'::uuid]) as id;
grant select on s to authenticated;
select is((select status from public.workout_session_members where user_id = '22222222-2222-2222-2222-222222222222'),
  'invited', 'Bia foi convidada');
select is((select count(*)::int from public.notifications where kind = 'workout_invite'), 0,
  'o aviso é só da Bia (Ana não vê)');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'workout_invite'), 1, 'Bia recebe o aviso');
select is((select page_name from public.my_workout_invites()), 'Treino A', 'convite aberto para a Bia');
select throws_ok($$ select public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', 1) $$,
  'P0002', null, 'convidada ainda não marca');
select lives_ok($$ select public.join_workout_session((select id from s)) $$, 'Bia entra');
select is((select count(*)::int from public.my_workout_invites()), 0, 'convite some depois de entrar');

-- Série do grupo: Bia marca a 1ª, Ana a 2ª (a última conclui, XP da Ana)
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', 1, '{"weight": "40 kg"}') ->> 'done_reps'),
  '1', 'Bia marca a primeira série');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select progress -> 'c0000000-0000-0000-0000-000000000001' ->> 'reps' from public.workout_sessions),
  '1', 'Ana vê a contagem do grupo');
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', 1) ->> 'completed'),
  'true', 'Ana marca a última e conclui');
select is((select completed_by from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'concluída por quem marcou a última');
select ok((select count(*) from public.xp_events where user_id = auth.uid() and task_id = 'c0000000-0000-0000-0000-000000000001' and kind = 'task') > 0, 'evento de XP para a Ana');
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', 1) ->> 'done_reps'),
  '2', 'marcar a mais não passa do total');
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', -1) ->> 'done_reps'),
  '1', 'desfazer a última');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'),
  'todo', 'desfazer a última reabre');

-- Estado ao vivo
select lives_ok($$ select public.set_workout_state((select id from s), '{"task_id": "c0000000-0000-0000-0000-000000000002"}') $$,
  'muda o exercício atual');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.workout_sessions), 0, 'estranho não vê a sessão');
select throws_ok($$ update public.workout_sessions set ended_at = now() $$, '42501', null,
  'ninguém escreve direto');

-- Todos saem: a sessão termina
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.leave_workout_session((select id from s));
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.leave_workout_session((select id from s));
select isnt((select ended_at from public.workout_sessions), null, 'sem ninguém dentro, a sessão termina');

select * from finish();
rollback;
