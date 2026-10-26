-- V6 AC15B: treino da Academia num grupo de treino. Os membros recebem ao vivo, quem sai do grupo
-- perde, e só o treino da Academia de quem gerencia os envios vai para grupos em que cria treinos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Academia');
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Grupo da manhã', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Grupo da noite', 'project');
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000004', 'Coisas');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lista', 'list');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino"}]');
reset role;
update public.folders set is_gym = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.folders set gym_group = true
  where id in ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'viewer');
set local role authenticated;

select is((select count(*)::int from public.page_group_options('bbbbbbbb-0000-0000-0000-000000000001')), 2,
  'os dois grupos aparecem para o treino');
select throws_ok($$ select public.set_page_groups('bbbbbbbb-0000-0000-0000-000000000002',
  array['aaaaaaaa-0000-0000-0000-000000000002'::uuid]) $$, '42501', null, 'página fora da Academia não vai');
select lives_ok($$ select public.set_page_groups('bbbbbbbb-0000-0000-0000-000000000001',
  array['aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000003'::uuid]) $$,
  'Ana põe o treino nos dois grupos');
select is((select linked from public.page_group_options('bbbbbbbb-0000-0000-0000-000000000001')
           where folder_id = 'aaaaaaaa-0000-0000-0000-000000000002'), true, 'aparece como ligado');

-- Bia (nos dois grupos) recebe um envio só; Caio (Leitor no da noite) também recebe
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.page_shares where recipient_id = '22222222-2222-2222-2222-222222222222'
           and status = 'active'), 1, 'Bia recebe um envio só');
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1,
  'Bia lê o treino');
select is((select count(*)::int from public.group_linked_pages('aaaaaaaa-0000-0000-0000-000000000002')), 1,
  'o grupo mostra o treino da Ana');
update public.tasks set title = 'x' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select title from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'Supino',
  'membro do grupo não edita o treino');
select throws_ok($$ select public.set_page_groups('bbbbbbbb-0000-0000-0000-000000000001', '{}') $$,
  '42501', null, 'membro não muda os grupos do treino dos outros');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1,
  'Caio lê o treino');

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'estranho não lê o treino');
select is((select count(*)::int from public.page_group_links), 0, 'estranho não vê os vínculos');
select is((select count(*)::int from public.group_linked_pages('aaaaaaaa-0000-0000-0000-000000000002')), 0,
  'estranho não vê os treinos do grupo');

-- Caio sai do grupo da noite: perde o treino
reset role;
delete from public.folder_members
  where folder_id = 'aaaaaaaa-0000-0000-0000-000000000003' and user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'quem sai do grupo perde o treino');

-- Ana tira do grupo da manhã: Bia continua pelo da noite; tira dos dois, Bia perde
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.set_page_groups('bbbbbbbb-0000-0000-0000-000000000001', array['aaaaaaaa-0000-0000-0000-000000000003'::uuid]);
select is((select group_id from public.page_shares where recipient_id = '22222222-2222-2222-2222-222222222222'
           and status = 'active'), 'aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'Bia segue pelo outro grupo');
select public.set_page_groups('bbbbbbbb-0000-0000-0000-000000000001', '{}');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'fora de todos os grupos, Bia perde o treino');

select * from finish();
rollback;
