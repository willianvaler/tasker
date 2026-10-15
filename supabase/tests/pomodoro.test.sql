-- V3 §5 (K1/K3): pomodoro e cronômetro viram tempo registrado; o servidor confere o horário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'greg@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Obra');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Orçamento');

-- Foco de 25 min que começou há 26: terminou de verdade
select lives_ok($$ select public.start_timer('a0000000-0000-0000-0000-000000000001', 'pomodoro', now() - interval '26 minutes',
  1500, 'c0000000-0000-0000-0000-000000000001', '{"phase": "focus", "cycle": 1}') $$, 'foco iniciado');
select lives_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000001', 'done') $$, 'foco feito');
select is((select minutes from public.time_entries where timer_id = 'a0000000-0000-0000-0000-000000000001'), 25,
  'o foco vira 25 min registrados');
select is((select actual_minutes from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 25,
  'e soma na tarefa');
select lives_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000001', 'done') $$, 'feito de novo');
select is((select count(*)::int from public.time_entries), 1, 'não registra duas vezes');

-- Foco "feito" antes do fim não conta
select lives_ok($$ select public.start_timer('a0000000-0000-0000-0000-000000000002', 'pomodoro', now() - interval '1 minute',
  1500, null, '{"phase": "focus"}') $$, 'outro foco');
select lives_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000002', 'done') $$, 'feito cedo');
select is((select count(*)::int from public.time_entries), 1, 'foco interrompido não vira tempo');

-- Pausa do pomodoro também não
select lives_ok($$ select public.start_timer('a0000000-0000-0000-0000-000000000003', 'pomodoro', now() - interval '6 minutes',
  300, null, '{"phase": "short"}') $$, 'pausa curta');
select lives_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000003', 'done') $$, 'pausa feita');
select is((select count(*)::int from public.time_entries), 1, 'pausa não é tempo de tarefa');

-- O Greg (do projeto) vê o tempo da tarefa; o estranho, não
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.time_entries), 1, 'membro do projeto vê o tempo das tarefas');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.time_entries), 0, 'estranho não vê');

select * from finish();
rollback;
