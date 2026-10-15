-- V3 §3.4 (L5): painel "Alunos": números por aluno, cargas por conclusão, lembrete e arquivar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna.a@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'aluno.b@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly');
insert into public.tasks (id, page_id, title, repeat_plan) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', '{"mode": "sets", "total": 2}'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Alongar', null);
reset role;
insert into public.page_shares (id, page_id, owner_id, recipient_id, mode, status, accepted_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'live', 'active', now()),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'live', 'active', now());
set local role authenticated;

-- A aluna faz o Supino (2 séries com carga) e marca o Alongar com observação
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "20kg", "reps": 10}');
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "22kg", "reps": 8}');
select public.check_item('c0000000-0000-0000-0000-000000000002', true, 'ombro doeu');
select throws_ok($$ select * from public.page_students('bbbbbbbb-0000-0000-0000-000000000001') $$, 'P0002', null,
  'aluna não abre o painel');

-- O treinador vê os números
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.page_students('bbbbbbbb-0000-0000-0000-000000000001')), 2, 'dois alunos');
select is((select done_now || '/' || items from public.page_students('bbbbbbbb-0000-0000-0000-000000000001')
           where recipient_id = '22222222-2222-2222-2222-222222222222'), '2/2', 'a aluna fez tudo nesta semana');
select is((select sessions || '/' || expected from public.page_students('bbbbbbbb-0000-0000-0000-000000000001')
           where recipient_id = '22222222-2222-2222-2222-222222222222'), '1/4', 'aderência: 1 de 4 semanas');
select is((select notes_recent from public.page_students('bbbbbbbb-0000-0000-0000-000000000001')
           where recipient_id = '22222222-2222-2222-2222-222222222222'), 1, 'uma observação nova');
select is((select done_now from public.page_students('bbbbbbbb-0000-0000-0000-000000000001')
           where recipient_id = '33333333-3333-3333-3333-333333333333'), 0, 'o aluno B ainda não fez');
select is((select values -> 1 ->> 'weight' from public.share_checks where task_id = 'c0000000-0000-0000-0000-000000000001'),
  '22kg', 'a conclusão guarda as cargas, com a última série');

-- Lembrete: um por dia
select lives_ok($$ select public.remind_student('dddddddd-0000-0000-0000-000000000002') $$, 'lembra o aluno B');
select throws_ok($$ select public.remind_student('dddddddd-0000-0000-0000-000000000002') $$, '22023', null,
  'não lembra de novo no mesmo dia');

-- Arquivar tira o acesso
select lives_ok($$ select public.archive_page_share('dddddddd-0000-0000-0000-000000000002') $$, 'arquiva o aluno B');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select ok(not public.is_page_recipient('bbbbbbbb-0000-0000-0000-000000000001'), 'arquivado não recebe mais');

select * from finish();
rollback;
