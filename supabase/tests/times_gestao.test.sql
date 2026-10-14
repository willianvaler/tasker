-- V2 §4.3 (E4): cargos no time, sempre 1 Dono e log de auditoria.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');
reset role;
insert into public.team_members (team_id, user_id, role) values
  ('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member');
set local role authenticated;

-- O último Dono não sai nem deixa de ser Dono
select throws_ok(
  $$ select public.set_team_member_role('7ea70000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin') $$,
  '22023', null, 'último Dono não perde o cargo');
select throws_ok(
  $$ select public.remove_team_member('7ea70000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$,
  '22023', null, 'último Dono não sai');

-- Admin muda Membro, mas não mexe em Admin/Dono
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_team_member_role('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'guest') $$,
  'Admin muda Membro para Convidado');
select throws_ok(
  $$ select public.set_team_member_role('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'admin') $$,
  '42501', null, 'Admin não promove a Admin');
select throws_ok(
  $$ select public.remove_team_member('7ea70000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'Admin não tira o Dono');

-- Membro não tira ninguém, mas sai sozinho
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_team_member('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'Convidado não tira ninguém');
select is((select count(*)::int from public.team_audit), 0, 'Convidado não lê o log');

-- O Dono passa o cargo para a Bia e aí pode deixar de ser Dono
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_team_member_role('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'owner') $$,
  'Dono promove outra pessoa a Dono');
select lives_ok(
  $$ select public.set_team_member_role('7ea70000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin') $$,
  'com outro Dono, deixa de ser');

-- Projeto do time e exclusão entram no log
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.folders (id, name, team_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', '7ea70000-0000-0000-0000-000000000001');
delete from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.teams set name = 'Família Silva' where id = '7ea70000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.remove_team_member('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  'Dono tira Convidado');

select results_eq(
  $$ select action from public.team_audit order by created_at, action $$,
  $$ values ('member_removed'), ('project_added'), ('project_deleted'), ('role_changed'), ('role_changed'),
            ('role_changed'), ('team_renamed') $$,
  'log com cargos, projeto, nome e saída');
select is((select payload ->> 'to' from public.team_audit where action = 'team_renamed'), 'Família Silva',
  'log guarda o nome novo');
select is((select actor_id::text from public.team_audit where action = 'member_removed'),
  '22222222-2222-2222-2222-222222222222', 'log guarda quem fez');

-- Só o Dono apaga o time
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.teams where id = '7ea70000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.teams), 1, 'Admin não apaga o time');

select * from finish();
rollback;
