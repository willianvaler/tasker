-- V2 §4.2/§4.3 (E2): cargo do time nos projetos, cargo próprio no projeto e permissões nas policies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'duda@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');
reset role;
insert into public.team_members (team_id, user_id, role) values
  ('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member'),
  ('7ea70000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'guest');
set local role authenticated;

-- A Ana cria o projeto no time: todo mundo do time entra, menos o convidado
insert into public.folders (id, name, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', '7ea70000-0000-0000-0000-000000000001');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carvão');

select results_eq(
  $$ select user_id::text, role::text, source from public.folder_members
     where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'owner', 'team'),
            ('22222222-2222-2222-2222-222222222222', 'manager', 'team'),
            ('33333333-3333-3333-3333-333333333333', 'editor', 'team') $$,
  'Dono→Dono, Admin→Gerente, Membro→Editor, Convidado fica de fora');
select is((select kind from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'project',
  'pasta de time é projeto');

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.tasks where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'convidado do time não vê projeto para onde não foi chamado');

-- Editor (pelo time) não convida; Gerente sim
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'editor') $$,
  '42501', null, 'Editor não convida');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'editor') $$,
  'Gerente convida');
select throws_ok(
  $$ select public.remove_member('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  '22023', null, 'quem vem do time não sai pelo projeto');

-- O Gerente baixa o Caio para Colaborador neste projeto
select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor');
select is((select role::text || '/' || source from public.folder_members
  where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333'),
  'contributor/direct', 'cargo próprio no projeto vale no lugar do do time');

-- Mudar o cargo no time não passa por cima do cargo próprio
reset role;
update public.team_members set role = 'admin'
where team_id = '7ea70000-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333';
update public.team_members set role = 'member'
where team_id = '7ea70000-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select role::text from public.folder_members
  where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333'),
  'contributor', 'cargo no time não apaga o cargo próprio');

-- Colaborador: cria, mexe no que é seu, não mexe no dos outros
select lives_ok(
  $$ insert into public.tasks (id, page_id, title) values
     ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Gelo') $$,
  'Colaborador cria tarefa');
select lives_ok(
  $$ update public.tasks set title = 'Gelo (2 sacos)' where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  'Colaborador edita a tarefa que criou');
select throws_ok(
  $$ update public.tasks set title = 'Carvão!' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'Colaborador não edita tarefa de outra pessoa');
select throws_ok($$ select public.complete_task('cccccccc-0000-0000-0000-000000000001') $$,
  '42501', null, 'Colaborador não conclui tarefa que não é dele');
select throws_ok(
  $$ delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'Colaborador não apaga tarefa de outra pessoa');
select throws_ok(
  $$ insert into public.pages (folder_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bebidas') $$,
  '42501', null, 'Colaborador não cria página');

-- Atribuída a ele, conclui
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.task_assignees (task_id, user_id) values
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok($$ select public.complete_task('cccccccc-0000-0000-0000-000000000001') $$,
  'Colaborador conclui tarefa atribuída a ele');
select lives_ok($$ delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  'Colaborador apaga a tarefa que criou');
select throws_ok(
  $$ insert into public.task_assignees (task_id, user_id) values
     ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'Colaborador não delega');

-- Volta ao cargo do time
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.reset_member_role('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
select is((select role::text || '/' || source from public.folder_members
  where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333'),
  'editor/team', 'volta a usar o cargo do time');

-- Leitor comenta, mas não cria tarefa
select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.comments (task_id, body) values ('cccccccc-0000-0000-0000-000000000001', 'Levo o carvão') $$,
  'Leitor comenta');
select throws_ok(
  $$ insert into public.tasks (page_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Pão') $$,
  '42501', null, 'Leitor não cria tarefa');

-- Gerente não exclui o projeto; Dono do time sim
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
delete from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1,
  'Gerente não exclui o projeto');

-- Sair do time tira de todos os projetos dele
reset role;
delete from public.team_members
where team_id = '7ea70000-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'quem sai do time perde os projetos dele');

-- Projeto pessoal entra no time
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Mudança', 'project');
select public.set_project_team('aaaaaaaa-0000-0000-0000-000000000002', '7ea70000-0000-0000-0000-000000000001');
select results_eq(
  $$ select user_id::text, role::text from public.folder_members
     where folder_id = 'aaaaaaaa-0000-0000-0000-000000000002' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'owner'),
            ('22222222-2222-2222-2222-222222222222', 'manager') $$,
  'projeto pessoal que entra no time recebe as pessoas do time');

-- E sai: quem moveu fica Dono, o resto continua com o mesmo cargo
select public.set_project_team('aaaaaaaa-0000-0000-0000-000000000002', null);
select results_eq(
  $$ select user_id::text, role::text, source from public.folder_members
     where folder_id = 'aaaaaaaa-0000-0000-0000-000000000002' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'owner', 'direct'),
            ('22222222-2222-2222-2222-222222222222', 'manager', 'direct') $$,
  'projeto que sai do time fica com quem estava');

select lives_ok($$ delete from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'Dono do time exclui o projeto');

select * from finish();
rollback;
