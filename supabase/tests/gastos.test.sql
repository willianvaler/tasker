-- ESCOPO_V9 (GA1): página de gastos, permissões, foto da nota, lixeira e leituras de foto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'colaborador@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Reforma', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'contributor');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type, budget_cents) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Gastos', 'expenses', 5000000),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tarefas', 'list', null);
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Comprar piso');

-- Dono lança
select lives_ok($$ insert into public.expenses (id, page_id, description, category, amount_cents, paid_by, task_id, nfce_key)
  values ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Leroy Merlin',
          'Material', 184000, '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001',
          '35241012345678000190650010000123451000123456') $$, 'dono lança um gasto');
select is((select folder_id from public.expenses), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'folder_id vem da página');
select is((select kind || ':' || currency from public.expenses), 'out:BRL', 'saída em reais por padrão');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents, nfce_key)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Leroy de novo', 184000,
          '35241012345678000190650010000123451000123456') $$,
  '23505', null, 'a mesma NFC-e não entra duas vezes na página');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Fora do lugar', 100) $$,
  '22023', null, 'só em página de gastos');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Grátis', 0) $$,
  '23514', null, 'valor tem de ser positivo');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents, paid_by)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Pago por estranho', 100, '33333333-3333-3333-3333-333333333333') $$,
  '22023', null, 'quem pagou tem de ser do projeto');
select throws_ok($$ update public.expenses set folder_id = null $$, '42501', null,
  'folder_id não é gravável pelo cliente');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('receipts', 'aaaaaaaa-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000001/nota.webp',
          '11111111-1111-1111-1111-111111111111') $$, 'dono envia a foto da nota');

-- Leitor vê, não lança, não edita, não apaga
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.expenses), 1, 'leitor vê o gasto');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 1, 'leitor vê a foto');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Do leitor', 100) $$,
  '42501', null, 'leitor não lança');
update public.expenses set amount_cents = 1;
delete from public.expenses;
select is((select amount_cents from public.expenses), 184000::bigint, 'leitor não edita nem apaga');

-- Colaborador lança e mexe só nos seus
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok($$ insert into public.expenses (id, page_id, description, amount_cents, kind)
  values ('e0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Reembolso', 5000, 'in') $$,
  'colaborador lança');
update public.expenses set amount_cents = 1 where id = 'e0000000-0000-0000-0000-000000000001';
select is((select amount_cents from public.expenses where id = 'e0000000-0000-0000-0000-000000000001'),
  184000::bigint, 'colaborador não edita o do dono');
select lives_ok($$ update public.expenses set amount_cents = 6000 where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'colaborador edita o seu');
select is((select amount_cents from public.expenses where id = 'e0000000-0000-0000-0000-000000000002'),
  6000::bigint, 'e a edição vale');

-- Estranho não vê nada
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.expenses), 0, 'estranho não vê os gastos');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 0, 'estranho não vê a foto');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Intruso', 100) $$,
  '42501', null, 'estranho não lança');

-- Lixeira: apagar e restaurar
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.expenses where id = 'e0000000-0000-0000-0000-000000000001';
select is((select title from public.trash_list() where kind = 'expenses'), 'Leroy Merlin',
  'gasto apagado vai para a lixeira com a descrição');
select lives_ok($$ select public.restore_deleted((select id from public.trash_list() where kind = 'expenses')) $$,
  'restaurar o gasto');
select is((select count(*)::int from public.expenses), 2, 'o gasto volta');

-- Mover a página para outra pasta leva os lançamentos; o pagador de fora sai
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pessoal');
update public.pages set folder_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is((select count(*)::int from public.expenses where folder_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 2,
  'os lançamentos vão junto com a página');
select is((select paid_by from public.expenses where id = 'e0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'o dono continua pagador (é membro da pasta nova)');

-- Leituras de foto: o limite conta só as que deram certo, no mês
reset role;
insert into public.photo_reads (user_id, kind, provider, ok) values
  ('11111111-1111-1111-1111-111111111111', 'receipt', 'gemini', true),
  ('11111111-1111-1111-1111-111111111111', 'receipt', 'gemini', false),
  ('11111111-1111-1111-1111-111111111111', 'list', 'gemini', true);
set local role authenticated;
select is(public.photo_reads_left(), public.photo_read_limit() - 2, 'sobram as leituras do mês');

select * from finish();
rollback;
