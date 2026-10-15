-- V3 §6 (M5): campos personalizados por página.
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
select lives_ok($$ insert into public.page_fields (id, page_id, name, kind) values
  ('f0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Valor', 'money') $$, 'dono cria campo');
insert into public.tasks (id, page_id, title, custom) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Piso', '{"f0000000-0000-0000-0000-000000000001": 1200}');
select is((select custom ->> 'f0000000-0000-0000-0000-000000000001' from public.tasks), '1200', 'a tarefa guarda o valor');
select throws_ok($$ insert into public.page_fields (page_id, name, kind)
  select 'bbbbbbbb-0000-0000-0000-000000000001', 'C' || g, 'text' from generate_series(1, 10) g $$, '22023', null, 'no máximo 10');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.page_fields), 1, 'Leitor vê o campo');
select throws_ok($$ insert into public.page_fields (page_id, name, kind) values ('bbbbbbbb-0000-0000-0000-000000000001', 'X', 'text') $$, '42501', null, 'Leitor não cria campo');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.page_fields), 0, 'estranho não vê');
select * from finish();
rollback;
