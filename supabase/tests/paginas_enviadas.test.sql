-- V3 §3 (L1): página enviada. O aluno lê a página e as tarefas, nada mais do autor; nunca vê o
-- envio do outro aluno; e não muda a estrutura pela API.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna.a@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'aluno.b@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Particular', 'list');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Anotação do treinador');
reset role;
insert into public.page_shares (page_id, owner_id, recipient_id, mode, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'live', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'live', 'active');
set local role authenticated;

select is((select count(*)::int from public.page_shares), 2, 'o treinador vê os dois envios');

-- Aluna A
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select string_agg(name, ',') from public.pages where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Treino A', 'a aluna vê só a página recebida');
select is((select count(*)::int from public.tasks where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'e as tarefas dela');
select is((select count(*)::int from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'não vê a pasta do treinador');
select is((select count(*)::int from public.page_shares), 1, 'vê o próprio envio, nunca o do outro aluno');
select throws_ok($$ insert into public.tasks (page_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Extra') $$,
  '42501', null, 'não cria item');
update public.tasks set title = 'Mudado' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select title from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'Supino',
  'não edita item (a escrita fica com o autor)');
delete from public.tasks where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.tasks where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'não apaga item');
select throws_ok($$ insert into public.page_shares (page_id, recipient_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'não reenvia a página');
select throws_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000001') $$,
  'P0002', null, 'não conclui a tarefa do autor (o progresso dela é à parte, L2)');

-- Estranho
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.pages where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'estranho não vê nada');
select is((select count(*)::int from public.page_shares), 0, 'nem os envios');

-- Revogado: sai da aluna
reset role;
update public.page_shares set status = 'revoked' where recipient_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.pages where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'envio revogado: a página some');
select is((select count(*)::int from public.tasks where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'e as tarefas');

select * from finish();
rollback;
