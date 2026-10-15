-- V3 §2.4 (I7): vínculos "Relacionados". Título só para quem tem acesso; ligar pede editar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'greg@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- Willian: projeto Casa (o Greg é Editor, a Ana Leitora) e pasta pessoal Saúde
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Saúde', 'folder');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cardápio'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Treinos');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar frango');

-- Willian liga o Cardápio (projeto) aos Treinos (pessoal)
insert into public.relations (from_type, from_id, to_type, to_id) values
  ('page', 'bbbbbbbb-0000-0000-0000-000000000001', 'page', 'bbbbbbbb-0000-0000-0000-000000000002');
select is((select title from public.item_relations('page', 'bbbbbbbb-0000-0000-0000-000000000001')), 'Treinos',
  'o dono vê o título do outro lado');
select is((select title from public.item_relations('page', 'bbbbbbbb-0000-0000-0000-000000000002')), 'Cardápio',
  'e o vínculo vale nos dois sentidos');

-- O Greg vê o vínculo, mas não o título da pasta pessoal do Willian
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.item_relations('page', 'bbbbbbbb-0000-0000-0000-000000000001')), 1,
  'o Editor vê que existe um vínculo');
select is((select title from public.item_relations('page', 'bbbbbbbb-0000-0000-0000-000000000001')), null,
  'mas sem o título do que não acessa');
select is((select count(*)::int from public.relation_candidates('Trein')), 0, 'a busca não acha o que ele não vê');
select throws_ok($$ insert into public.relations (from_type, from_id, to_type, to_id) values
  ('task', 'c0000000-0000-0000-0000-000000000001', 'page', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501', null, 'não liga a um item que não vê');
select lives_ok($$ insert into public.relations (from_type, from_id, to_type, to_id) values
  ('task', 'c0000000-0000-0000-0000-000000000001', 'page', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  'Editor liga dentro do projeto');

-- Leitor só vê
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ insert into public.relations (from_type, from_id, to_type, to_id) values
  ('page', 'bbbbbbbb-0000-0000-0000-000000000001', 'folder', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'Leitor não liga');
select is((select bool_or(can_unlink) from public.item_relations('task', 'c0000000-0000-0000-0000-000000000001')),
  false, 'nem desliga');

-- Apagar a tarefa leva o vínculo
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.tasks where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.relations where from_type = 'task'), 0, 'item apagado leva o vínculo');

select * from finish();
rollback;
