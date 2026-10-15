-- V3 §5 (K1/K3): pomodoro e cronômetro viram tempo registrado; o servidor confere o horário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'greg@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
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

-- Cronômetro de 10 min na tarefa (K3)
select lives_ok($$ select public.start_timer('a0000000-0000-0000-0000-000000000004', 'stopwatch', now() - interval '10 minutes',
  null, 'c0000000-0000-0000-0000-000000000001') $$, 'cronômetro');
select is((public.update_timer('a0000000-0000-0000-0000-000000000004', 'done', 0, now())).state, 'done', 'parado');
select is((select minutes from public.time_entries where timer_id = 'a0000000-0000-0000-0000-000000000004'), 10,
  'o cronômetro vira 10 min');
-- Lançamento manual, idempotente
select lives_ok($$ select public.log_time('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 45) $$,
  'lançar 45 min');
select lives_ok($$ select public.log_time('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 45) $$,
  'o mesmo lançamento de novo');
select is((select actual_minutes from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 80,
  '25 + 10 + 45, sem duplicar');

-- O Greg (do projeto) vê o tempo da tarefa; o estranho, não
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.time_entries), 3, 'membro do projeto vê o tempo das tarefas');
select throws_ok($$ select public.delete_time_entry('e0000000-0000-0000-0000-000000000001') $$, '42501', null,
  'só quem registrou apaga');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.time_entries), 0, 'estranho não vê');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$ select public.log_time(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 10) $$, '42501', null,
  'Leitor não registra tempo');

-- Configuração: cada um a sua (o upsert do app grava a hora junto)
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.pomodoro_settings (focus_minutes, break_ideas, updated_at)
  values (30, '["ler"]', now()) on conflict (user_id) do update set focus_minutes = excluded.focus_minutes $$,
  'dono grava a configuração');
select is((select focus_minutes from public.pomodoro_settings), 30, 'e lê a dele');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.pomodoro_settings), 0, 'outro não vê');

select * from finish();
rollback;
