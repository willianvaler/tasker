-- V2 §4.3 (E5): cargos personalizados a partir das permissões atômicas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');
reset role;
insert into public.team_members (team_id, user_id, role) values
  ('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member'),
  ('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member');
set local role authenticated;

insert into public.folders (id, name, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', '7ea70000-0000-0000-0000-000000000001');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carvão');

-- "Comprador": cria e atribui, mas não edita o que é dos outros
insert into public.team_roles (id, team_id, name, grants) values
  ('dddddddd-0000-0000-0000-000000000001', '7ea70000-0000-0000-0000-000000000001', 'Comprador',
   array['task.create', 'task.assign', 'comment.create', 'task.complete:own']);
select is((select 'project.view' = any (grants) from public.team_roles), true, 'todo cargo vê o projeto');
select throws_ok(
  $$ insert into public.team_roles (team_id, name, grants) values
     ('7ea70000-0000-0000-0000-000000000001', 'Chefe', array['project.delete']) $$,
  '22023', null, 'excluir o projeto não entra em cargo personalizado');
select throws_ok(
  $$ insert into public.team_roles (team_id, name, grants) values
     ('7ea70000-0000-0000-0000-000000000001', 'Errado', array['voar']) $$,
  '22023', null, 'permissão fora do catálogo');

select public.set_member_custom_role('aaaaaaaa-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-000000000001');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok(public.has_permission('aaaaaaaa-0000-0000-0000-000000000001', 'task.assign'), 'cargo dá task.assign');
select ok(not public.has_permission('aaaaaaaa-0000-0000-0000-000000000001', 'task.edit'), 'e não dá task.edit');
select lives_ok(
  $$ insert into public.tasks (page_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Gelo') $$,
  'Comprador cria tarefa');
select lives_ok(
  $$ insert into public.task_assignees (task_id, user_id) values
     ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  'Comprador delega');
select throws_ok(
  $$ update public.tasks set title = 'Carvão!' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'Comprador não edita tarefa de outra pessoa');
select throws_ok(
  $$ insert into public.pages (folder_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bebidas') $$,
  '42501', null, 'nem cria página');
select is((select count(*)::int from public.team_roles), 1, 'membro do time vê os cargos');
delete from public.team_roles;
select is((select count(*)::int from public.team_roles), 1, 'Membro não apaga cargo');

-- Mudar as permissões do cargo vale na hora
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.team_roles set grants = array['task.edit'] where id = 'dddddddd-0000-0000-0000-000000000001';
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok(public.has_permission('aaaaaaaa-0000-0000-0000-000000000001', 'task.edit'), 'mudança no cargo vale na hora');
select lives_ok(
  $$ update public.tasks set title = 'Carvão (5 kg)' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'e com task.edit edita');

-- Apagar o cargo deixa a pessoa como Leitor
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.team_roles where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select role::text || '/' || coalesce(custom_role_id::text, '-') from public.folder_members
  where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'),
  'viewer/-', 'cargo apagado: fica Leitor');
select ok((select count(*) from public.team_audit where action in ('role_created', 'role_updated', 'role_deleted')) = 3,
  'cargos entram no histórico');

select * from finish();
rollback;
