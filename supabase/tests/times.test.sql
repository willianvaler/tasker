-- V2 §4.1: times isolados. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');
select is((select role::text from public.team_members where team_id = '7ea70000-0000-0000-0000-000000000001'),
  'owner', 'quem cria é Dono');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000002', 'Trabalho');

-- A Bia não vê o time da Ana, nem os membros dele
select is((select count(*)::int from public.teams), 1, 'só vê o próprio time');
select is((select count(*)::int from public.team_members where team_id = '7ea70000-0000-0000-0000-000000000001'),
  0, 'não vê membros de outro time');
update public.teams set name = 'Invadido' where id = '7ea70000-0000-0000-0000-000000000001';
delete from public.teams where id = '7ea70000-0000-0000-0000-000000000001';
select throws_ok(
  $$ insert into public.team_members (team_id, user_id) values
     ('7ea70000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'não se coloca num time por conta própria');
select throws_ok(
  $$ insert into public.teams (name, created_by) values ('Falso', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'não cria time em nome de outra pessoa');

-- O Caio entra como Membro no time da Ana (pelo superusuário, como faria o convite)
reset role;
insert into public.team_members (team_id, user_id, role) values
  ('7ea70000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member');
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.team_members), 2, 'membro vê os colegas do time');
update public.teams set name = 'Renomeado' where id = '7ea70000-0000-0000-0000-000000000001';
select is((select name from public.teams where id = '7ea70000-0000-0000-0000-000000000001'), 'Família',
  'Membro não renomeia o time');
select ok(not public.is_team_member('7ea70000-0000-0000-0000-000000000001', 'admin'), 'Membro não é Admin');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select name from public.teams where id = '7ea70000-0000-0000-0000-000000000001'), 'Família',
  'o time da Ana continua intacto');
update public.teams set name = 'Família Silva' where id = '7ea70000-0000-0000-0000-000000000001';
select is((select name from public.teams where id = '7ea70000-0000-0000-0000-000000000001'), 'Família Silva',
  'Dono renomeia');

select * from finish();
rollback;
