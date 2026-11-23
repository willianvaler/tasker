-- ES7 (D328): projeto de estudo (o interruptor) e onde parei (a posição de leitura de cada pessoa).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Engenharia', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'aaaaaaaa-0000-0000-0000-000000000001/dddddddd-0000-0000-0000-000000000001.pdf', '03 - M01 - Assis.pdf',
   'application/pdf', 1000);

update public.folders set study = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select ok((select study from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'a dona liga o plano de estudos');

select lives_ok($$ insert into public.reading_positions (material_id, position) values
  ('dddddddd-0000-0000-0000-000000000001', '{"page": 12}') $$, 'a dona guarda onde parou');

-- O leitor do projeto: guarda a própria posição, não vê a da dona, não muda o interruptor
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ insert into public.reading_positions (material_id, position) values
  ('dddddddd-0000-0000-0000-000000000001', '{"page": 3}') $$, 'o leitor guarda a dele');
select is((select (position ->> 'page')::int from public.reading_positions), 3, 'e só vê a dele');
update public.folders set study = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select ok((select study from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'o leitor não muda o interruptor');
set local role authenticated;

-- O estranho: não guarda posição de material que não vê
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ insert into public.reading_positions (material_id, position) values
  ('dddddddd-0000-0000-0000-000000000001', '{"page": 1}') $$, '42501', null, 'estranho não guarda');
select throws_ok($$ insert into public.reading_positions (user_id, material_id, position) values
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001', '{"page": 1}') $$,
  '42501', null, 'nem em nome de outra pessoa');

select * from finish();
rollback;
