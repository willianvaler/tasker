-- V6 AC13.2: o treinador define a regra e a carga inicial de cada aluno, só pela RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino B', 'cards');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Remada');
reset role;
insert into public.page_shares (id, page_id, owner_id, recipient_id, mode, status, accepted_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'live', 'active', now());
set local role authenticated;

select is(public.set_student_plan('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
  'linear', '40 kg'), '{"c0000000-0000-0000-0000-000000000001": {"progression": "linear", "weight": "40kg"}}'::jsonb,
  'treinador define a regra e a carga (sem espaço)');
select throws_ok($$ select public.set_student_plan('dddddddd-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002', 'linear', null) $$, 'P0002', null, 'só exercício da página enviada');
select throws_ok($$ select public.set_student_plan('dddddddd-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001', 'turbo', null) $$, '22023', null, 'regra desconhecida');
select throws_ok($$ select public.set_student_plan('dddddddd-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001', null, 'quarenta') $$, '22023', null, 'carga sem número');

-- A aluna lê o plano dela, mas não muda
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select coach_plan -> 'c0000000-0000-0000-0000-000000000001' ->> 'weight' from public.page_shares
  where id = 'dddddddd-0000-0000-0000-000000000001'), '40kg', 'a aluna lê o plano dela');
select throws_ok($$ select public.set_student_plan('dddddddd-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001', 'off', '100kg') $$, 'P0002', null, 'a aluna não define o próprio plano');
select throws_ok($$ update public.page_shares set coach_plan = '{}' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '42501', null, 'nem direto na tabela');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.set_student_plan('dddddddd-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001', 'off', null) $$, 'P0002', null, 'estranho não define');

-- Limpar tudo tira o exercício do plano
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.set_student_plan('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
  null, ''), '{}'::jsonb, 'sem regra e sem carga, volta ao plano da página');

select * from finish();
rollback;
