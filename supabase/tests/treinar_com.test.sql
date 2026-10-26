-- V6 AC15A: "Treinar com…" em qualquer treino. Amigos, gente dos times e dos grupos entram como
-- convidados da sessão: leem o treino só enquanto estão nela, marcam a série do grupo com o
-- próprio diário, e a conclusão que disparam é de quem começou o treino.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local'),
  ('55555555-5555-5555-5555-555555555555', 'dani@teste.local');

-- Bia é amiga da Ana; Caio é do time da Ana; Dani é de outro projeto da Ana
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'accepted', now());
insert into public.teams (id, name, created_by) values
  ('dddddddd-0000-0000-0000-000000000001', 'Time', '11111111-1111-1111-1111-111111111111');
insert into public.team_members (team_id, user_id, role) values
  ('dddddddd-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member')
  on conflict do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- Treino pessoal da Ana (ninguém mais na pasta) e um projeto com a Dani
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Meus treinos');
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Projeto', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'editor');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino", "repeat_plan": {"mode": "sets", "total": 2}},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Prancha"}]');
reset role;
update public.tasks set created_at = now() - interval '1 hour' where page_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;

select is((select count(*)::int from public.workout_partners('bbbbbbbb-0000-0000-0000-000000000001')), 3,
  'amiga, time e grupo aparecem no Treinar com…');
select is((select source from public.workout_partners('bbbbbbbb-0000-0000-0000-000000000001')
           where user_id = '22222222-2222-2222-2222-222222222222'), 'friend', 'Bia vem como amiga');
select throws_ok($$ select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001',
  array['44444444-4444-4444-4444-444444444444'::uuid]) $$, '22023', null, 'estranho não é chamado');

-- Ana começa sozinha, faz uma série e chama a Bia no meio do treino
create temp table s as select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001') as id;
grant select on s to authenticated;
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "40 kg"}');
select lives_ok($$ select public.invite_to_workout_session((select id from s),
  array['22222222-2222-2222-2222-222222222222'::uuid]) $$, 'chama a amiga no meio do treino');
select is((select progress -> 'c0000000-0000-0000-0000-000000000001' ->> 'reps' from public.workout_sessions),
  '1', 'a série que Ana fez sozinha entra na contagem do grupo');
select throws_ok($$ select public.invite_to_workout_session((select id from s),
  array['44444444-4444-4444-4444-444444444444'::uuid]) $$, '22023', null, 'estranho não é chamado no meio');

-- Estranho não lê o treino
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'estranho não lê as tarefas');

-- Bia, convidada, lê a página e as tarefas e vê quem está na sessão
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.pages where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1,
  'convidada lê a página');
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 2,
  'convidada lê as tarefas');
select is((select count(*)::int from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'mas não vê a pasta');
select is((select count(*)::int from public.workout_session_people((select id from s))), 2,
  'vê quem está na sessão');
update public.tasks set title = 'x' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select title from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'Supino',
  'convidada não edita');
select lives_ok($$ select public.join_workout_session((select id from s)) $$, 'Bia entra');
select throws_ok($$ select public.log_rep('c0000000-0000-0000-0000-000000000001', 1) $$, 'P0002', null,
  'fora da sessão a série não é dela');

-- A última série do Supino é da Bia: o diário é dela, a conclusão é da Ana
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', 1,
  '{"weight": "30 kg"}') ->> 'completed'), 'true', 'convidada marca a última série');
select is((select completed_by from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'concluída em nome de quem começou o treino');
select is((select count(*)::int from public.workout_sets where task_id = 'c0000000-0000-0000-0000-000000000001'), 1,
  'a série vai para o diário da Bia');
select is(auth.uid(), '22222222-2222-2222-2222-222222222222'::uuid, 'depois, a Bia continua sendo a Bia');
select is((public.log_group_set((select id from s), 'c0000000-0000-0000-0000-000000000001', -1) ->> 'done_reps'),
  '1', 'convidada desfaz a última');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'),
  'todo', 'desfazer reabre a tarefa da Ana');
select throws_ok($$ select public.invite_to_workout_session((select id from s),
  array['33333333-3333-3333-3333-333333333333'::uuid]) $$, '42501', null, 'convidada não chama mais gente');

-- Saiu: não lê mais
select public.leave_workout_session((select id from s));
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'depois de sair, não lê mais o treino');

select * from finish();
rollback;
