-- ES4 (D325): material do projeto. A dona acrescenta PDF e anotação; o leitor vê e não acrescenta;
-- o estranho não vê; o caminho tem de ser o da pasta; só PDF; tirar vai para a lixeira e volta;
-- o espaço conta no 1 GB.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
insert into public.notes (id, folder_id, title, body) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '04 - M01 - Equilíbrio', 'texto'),
  ('bbbbbbbb-0000-0000-0000-000000000002', null, 'Solta', 'x');

select lives_ok($$ insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001.pdf',
   '03 - M01 - Arquimedes.pdf', 'application/pdf', 30000000) $$,
  'a dona acrescenta um PDF de 30 MB');
select lives_ok($$ insert into public.project_files (id, folder_id, kind, note_id, name) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'note',
   'bbbbbbbb-0000-0000-0000-000000000001', '04 - M01 - Equilíbrio.md') $$,
  'e uma anotação da pasta');
select throws_ok($$ insert into public.project_files (id, folder_id, kind, note_id, name) values
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'note',
   'bbbbbbbb-0000-0000-0000-000000000002', 'Solta.md') $$,
  '22023', null, 'anotação de fora da pasta é recusada');
select throws_ok($$ insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'outra/cccccccc-0000-0000-0000-000000000004.pdf', 'x.pdf', 'application/pdf', 10) $$,
  '22023', null, 'caminho de outra pasta é recusado');
select throws_ok($$ insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000005.pdf', 'x.html', 'text/html', 10) $$,
  '23514', null, 'só PDF');
select throws_ok($$ insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000006.pdf', 'grande.pdf', 'application/pdf', 60000000) $$,
  '23514', null, 'mais de 50 MB é recusado');
select is((public.storage_usage() ->> 'materials')::bigint, 30000000::bigint, 'o uso separado mostra o material');

-- Leitor: vê e não acrescenta
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.project_files), 2, 'leitor do projeto vê o material');
select throws_ok($$ insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'file',
   'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000007.pdf', 'y.pdf', 'application/pdf', 10) $$,
  '42501', null, 'leitor não acrescenta');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.project_files), 0, 'estranho não vê');

-- Tirar o PDF: vai para a lixeira (o arquivo fica) e volta
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.project_files where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select ok((select count(*) = 1 from public.deleted_items
           where kind = 'project_files' and row_id = 'cccccccc-0000-0000-0000-000000000001')
          and not exists (select 1 from public.storage_garbage
                          where path = 'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001.pdf'),
  'o material vai para a lixeira e o arquivo não é apagado');
set local role authenticated;
select public.restore_deleted((select id from public.deleted_items
                               where kind = 'project_files' and row_id = 'cccccccc-0000-0000-0000-000000000001'));
select is((select count(*)::int from public.project_files), 2, 'restaurar traz o material de volta');

select * from finish();
rollback;
