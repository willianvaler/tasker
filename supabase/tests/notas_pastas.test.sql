-- Correção do dono (20/10, D245): anotações em pastas e projetos. Quem é da pasta lê; quem cria
-- tarefas escreve; leitor não escreve; estranho não vê; a pessoal continua só da pessoa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.notes (id, title, folder_id) values
  ('e0000000-0000-0000-0000-000000000001', 'Da pasta', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.notes (id, title) values ('e0000000-0000-0000-0000-000000000002', 'Minha');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notes), 1, 'a colega vê a da pasta, não a pessoal da Ana');
select lives_ok($$ insert into public.notes (title, folder_id) values ('Da Bia', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'quem cria tarefas cria anotação na pasta');
update public.notes set body = 'editado' where id = 'e0000000-0000-0000-0000-000000000001';
select is((select body from public.notes where id = 'e0000000-0000-0000-0000-000000000001'), 'editado', 'e edita');

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.notes), 2, 'o leitor lê as da pasta');
select throws_ok($$ insert into public.notes (title, folder_id) values ('Do leitor', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'mas não escreve');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.notes), 0, 'estranho não vê nenhuma');
select throws_ok($$ insert into public.notes (title, folder_id) values ('Falsa', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'nem cria na pasta dos outros');

select * from finish();
rollback;
