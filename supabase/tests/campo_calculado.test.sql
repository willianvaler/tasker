-- VS2 (D318): campo calculado em page_fields (tipo `formula`, coluna `formula`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Reforma', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Orçamento');

select lives_ok($$ insert into public.page_fields (id, page_id, name, kind, formula) values
  ('f0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Total', 'formula', '{Valor} * {Quantidade}') $$,
  'dono cria campo calculado');
select throws_ok($$ insert into public.page_fields (page_id, name, kind) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Sem fórmula', 'formula') $$, '23514', null, 'calculado sem fórmula é recusado');
select throws_ok($$ insert into public.page_fields (page_id, name, kind, formula) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Texto', 'text', '1 + 1') $$, '23514', null, 'fórmula em campo comum é recusada');
select lives_ok($$ update public.page_fields set formula = '{Valor} * 2' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'dono muda a fórmula');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.page_fields set formula = '0' where id = 'f0000000-0000-0000-0000-000000000001';
reset role;
select is((select formula from public.page_fields where id = 'f0000000-0000-0000-0000-000000000001'),
  '{Valor} * 2', 'Leitor não muda a fórmula');
set local role authenticated;

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.page_fields), 0, 'estranho não vê');
select * from finish();
rollback;
