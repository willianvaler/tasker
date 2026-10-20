-- PB5 (D225): racha de contas nos gastos do projeto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Minhas contas', 'folder');
reset role;
insert into public.folder_members (folder_id, user_id, role, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor', now() + interval '1 minute'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer', now() + interval '2 minutes');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Gastos', 'expenses'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Casa', 'expenses');

-- Saída no projeto nasce dividida entre todos; entrada e pasta pessoal não
insert into public.expenses (id, page_id, description, amount_cents, paid_by) values
  ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carne', 30000,
   '11111111-1111-1111-1111-111111111111');
select is((select split_among from public.expenses where id = 'e0000000-0000-0000-0000-000000000001'),
  '["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "44444444-4444-4444-4444-444444444444"]'::jsonb,
  'saída no projeto: todos os membros dividem');
insert into public.expenses (id, page_id, description, amount_cents, kind) values
  ('e0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Vaquinha', 5000, 'in');
select is((select split_among from public.expenses where id = 'e0000000-0000-0000-0000-000000000002'), null,
  'entrada não divide');
insert into public.expenses (id, page_id, description, amount_cents) values
  ('e0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Luz', 20000);
select is((select split_among from public.expenses where id = 'e0000000-0000-0000-0000-000000000003'), null,
  'pasta de uma pessoa só não divide');

-- Mudar quem divide: só gente do projeto, sem repetir; vazio vira nulo
select lives_ok($$ update public.expenses set split_among = '["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"]'
  where id = 'e0000000-0000-0000-0000-000000000001' $$, 'tira o leitor da divisão');
select throws_ok($$ update public.expenses set split_among = '["33333333-3333-3333-3333-333333333333"]'
  where id = 'e0000000-0000-0000-0000-000000000001' $$, '22023', null, 'estranho não divide');
select throws_ok($$ update public.expenses set split_among = '["11111111-1111-1111-1111-111111111111", "11111111-1111-1111-1111-111111111111"]'
  where id = 'e0000000-0000-0000-0000-000000000001' $$, '22023', null, 'sem repetidos');
select throws_ok($$ update public.expenses set split_among = '[1, 2]'
  where id = 'e0000000-0000-0000-0000-000000000001' $$, '22023', null, 'só ids');
update public.expenses set split_among = '[]' where id = 'e0000000-0000-0000-0000-000000000003';
select is((select split_among from public.expenses where id = 'e0000000-0000-0000-0000-000000000003'), null,
  'lista vazia = não divide');

-- Acerto: Bia paga a Ana
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ insert into public.expenses (page_id, description, amount_cents, kind, paid_by, split_among)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Acerto', 15000, 'settle',
          '22222222-2222-2222-2222-222222222222', '["11111111-1111-1111-1111-111111111111"]') $$,
  'acerto de uma pessoa para outra');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents, kind, paid_by, split_among)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Acerto', 100, 'settle',
          '22222222-2222-2222-2222-222222222222', '["22222222-2222-2222-2222-222222222222"]') $$,
  '22023', null, 'acerto para si mesmo não');
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents, kind, paid_by)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Acerto', 100, 'settle', '22222222-2222-2222-2222-222222222222') $$,
  '22023', null, 'acerto precisa de quem recebe');

-- Leitor vê a divisão, não lança acerto; estranho não vê
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$ insert into public.expenses (page_id, description, amount_cents, kind, paid_by, split_among)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Acerto', 100, 'settle',
          '44444444-4444-4444-4444-444444444444', '["11111111-1111-1111-1111-111111111111"]') $$,
  '42501', null, 'leitor não lança');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.expenses where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'estranho não vê');

select * from finish();
rollback;
