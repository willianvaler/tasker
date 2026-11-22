-- ES3 (D324): imagens das anotações. A dona envia e vê; no projeto, o leitor vê e não envia; o
-- estranho não vê; o caminho tem de ser o da anotação; apagar a anotação leva a imagem para a
-- lixeira e restaurar traz de volta; remover a imagem põe o arquivo na fila de apagar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Física', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.notes (id, folder_id, title, body) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Torque', 'texto'),
  ('bbbbbbbb-0000-0000-0000-000000000002', null, 'Minha', 'x');

select lives_ok($$ insert into public.note_assets (id, note_id, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'notes/bbbbbbbb-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001.webp', 'porta.webp', 'image/webp', 1000) $$,
  'a dona envia a imagem');
select throws_ok($$ insert into public.note_assets (id, note_id, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001',
   'notes/bbbbbbbb-0000-0000-0000-000000000002/cccccccc-0000-0000-0000-000000000002.webp', 'x.webp', 'image/webp', 10) $$,
  '22023', null, 'caminho de outra anotação é recusado');
select throws_ok($$ insert into public.note_assets (id, note_id, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001',
   'notes/bbbbbbbb-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000003.pdf', 'x.pdf', 'application/pdf', 10) $$,
  '23514', null, 'só imagem');
insert into public.note_assets (id, note_id, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002',
   'notes/bbbbbbbb-0000-0000-0000-000000000002/cccccccc-0000-0000-0000-000000000004.png', 'minha.png', 'image/png', 500);

-- Leitor do projeto: vê a do projeto, não a pessoal; não envia
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.note_assets), 1, 'leitor do projeto vê a imagem da anotação do projeto');
select ok(public.can_see_note('bbbbbbbb-0000-0000-0000-000000000001') and not public.can_edit_note('bbbbbbbb-0000-0000-0000-000000000001'),
  'leitor lê e não muda');
select throws_ok($$ insert into public.note_assets (id, note_id, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001',
   'notes/bbbbbbbb-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000005.webp', 'y.webp', 'image/webp', 10) $$,
  '42501', null, 'leitor não envia');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.note_assets), 0, 'estranho não vê');

-- Lixeira: apagar a anotação leva a imagem junto, e restaurar traz de volta
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.notes where id = 'bbbbbbbb-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.deleted_items where kind = 'note_assets'), 1,
  'a imagem vai para a lixeira com a anotação');
select is((select count(*)::int from public.storage_garbage where path like 'notes/bbbbbbbb-0000-0000-0000-000000000001/%'), 0,
  'e o arquivo não é apagado');
set local role authenticated;
select public.restore_deleted((select id from public.deleted_items where kind = 'notes' limit 1));
select is((select count(*)::int from public.note_assets where note_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1,
  'restaurar a anotação traz a imagem');

-- Remover a imagem: o arquivo entra na fila de apagar
delete from public.note_assets where id = 'cccccccc-0000-0000-0000-000000000004';
reset role;
select is((select count(*)::int from public.storage_garbage
           where path = 'notes/bbbbbbbb-0000-0000-0000-000000000002/cccccccc-0000-0000-0000-000000000004.png'), 1,
  'remover a imagem põe o arquivo na fila de apagar');

select * from finish();
rollback;
