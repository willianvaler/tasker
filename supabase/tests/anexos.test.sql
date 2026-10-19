-- V4 §4 (N1): anexos de tarefa (tabela e arquivos no Storage).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
-- A fila de arquivos a apagar é do banco inteiro: começa vazia aqui (a transação desfaz)
delete from public.storage_garbage;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Obra', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Fotos');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Medir a parede');

select lives_ok($$ insert into public.task_attachments (id, task_id, path, thumb_path, name, mime, size, width, height)
  values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/d1.webp',
          'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/d1.thumb.webp',
          'parede.jpg', 'image/webp', 350000, 2048, 1536) $$, 'dono anexa');
select is((select folder_id from public.task_attachments), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'folder_id vem da tarefa');
select throws_ok($$ insert into public.task_attachments (id, task_id, path, name, mime, size)
  values (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'x/outra-tarefa/a.pdf', 'a.pdf', 'application/pdf', 10) $$,
  '22023', null, 'caminho de outra tarefa é recusado');
select throws_ok($$ insert into public.task_attachments (id, task_id, path, name, mime, size)
  values (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/g.bin', 'g', 'x', 20000000) $$,
  '23514', null, 'mais de 10 MB é recusado');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('attachments', 'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/d1.webp',
          '11111111-1111-1111-1111-111111111111') $$, 'dono envia o arquivo');

-- Leitor vê, mas não anexa nem apaga
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.task_attachments), 1, 'leitor vê o anexo');
select throws_ok($$ insert into public.task_attachments (id, task_id, path, name, mime, size)
  values (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/z.pdf', 'z.pdf', 'application/pdf', 10) $$,
  '42501', null, 'leitor não anexa');
delete from public.task_attachments;
select is((select count(*)::int from public.task_attachments), 1, 'leitor não apaga');

-- Estranho não vê nada
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.task_attachments), 0, 'estranho não vê o anexo');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'), 0, 'estranho não vê o arquivo');

-- Uso, cota, lixeira e fila de apagar arquivos (N4)
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.attachment_usage(), 350000::bigint, 'uso do dono');
select throws_ok($$ insert into public.task_attachments (id, task_id, path, name, mime, size)
  select gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
         'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001/' || g || '.bin', 'g', 'x', 10000000
  from generate_series(1, 110) g $$, '22023', null, 'passa de 1 GB: recusado');

delete from public.tasks where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.deleted_items where kind = 'task_attachments'), 1,
  'apagar a tarefa leva o anexo para a lixeira');
select is((select count(*)::int from public.storage_garbage), 0, 'e o arquivo fica (pode voltar)');
set local role authenticated;
select lives_ok($$ select public.restore_deleted((select id from public.deleted_items where kind = 'tasks')) $$,
  'restaurar a tarefa');
select is((select count(*)::int from public.task_attachments), 1, 'o anexo volta junto');

delete from public.task_attachments;
reset role;
select is((select count(*)::int from public.storage_garbage), 2,
  'remover o anexo põe o arquivo e a miniatura na fila de apagar');

select * from finish();
rollback;
