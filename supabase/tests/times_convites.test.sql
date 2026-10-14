-- V2 §4.1 (E3): convites do time, convite por e-mail e pedido de entrada com aprovação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'duda@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');

create temp table t (token text, id uuid) on commit drop;
grant all on t to authenticated;
insert into t select token, id from public.create_team_invite('7ea70000-0000-0000-0000-000000000001', 'member', 7, 2);
select is((select (expires_at - created_at) between interval '6 days 23 hours' and interval '7 days 1 hour'
  from public.team_invites where id = (select id from t)), true, 'validade escolhida');

-- A Bia entra pelo link
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((public.team_invite_preview((select token from t)) ->> 'team_name'), 'Família', 'prévia mostra o time');
select is((public.accept_team_invite((select token from t)) ->> 'status'), 'joined', 'entra pelo link');
select is((public.accept_team_invite((select token from t)) ->> 'status'), 'already', 'segunda vez: já está');
select throws_ok($$ select public.create_team_invite('7ea70000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Membro não convida');

-- Limite de usos
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((public.accept_team_invite((select token from t)) ->> 'status'), 'joined', 'segundo uso');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok(format('select public.accept_team_invite(%L)', (select token from t)),
  '22023', 'Este convite já foi usado o máximo de vezes', 'limite de usos');

-- Convite cancelado
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from t;
insert into t select token, id from public.create_team_invite('7ea70000-0000-0000-0000-000000000001');
select public.revoke_team_invite((select id from t));
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((public.team_invite_preview((select token from t)) ->> 'reason'), 'Este convite foi cancelado',
  'convite cancelado não vale');

-- Convite por e-mail: só a pessoa certa usa, e ela é avisada
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.create_team_invite('7ea70000-0000-0000-0000-000000000001', 'member', 14, 50, 'não é e-mail') $$,
  '22023', null, 'e-mail inválido');
update public.teams set join_approval = true where id = '7ea70000-0000-0000-0000-000000000001';
delete from t;
insert into t select token, id from public.create_team_invite('7ea70000-0000-0000-0000-000000000001', 'guest', 14, 50, ' Duda@Teste.local ');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(format('select public.accept_team_invite(%L)', (select token from t)),
  '42501', 'Este convite é para outro e-mail', 'outro e-mail não usa');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'team_invited'), 1, 'convidado por e-mail é avisado');
select is((select count(*)::int from public.team_invites), 1, 'vê o convite para o próprio e-mail');
select is((public.accept_team_invite((select token from t)) ->> 'status'), 'joined',
  'convite por e-mail não passa pela aprovação');

-- Link comum com aprovação: vira pedido
reset role;
delete from public.team_members where user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from t;
insert into t select token, id from public.create_team_invite('7ea70000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((public.accept_team_invite((select token from t)) ->> 'status'), 'requested', 'com aprovação, vira pedido');
select ok(not public.is_team_member('7ea70000-0000-0000-0000-000000000001'), 'ainda não está no time');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.team_join_requests), 0, 'Membro não vê pedidos');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.decide_join_request((select id from public.team_join_requests where status = 'pending'), true);
select is((select role::text from public.team_members where user_id = '33333333-3333-3333-3333-333333333333'),
  'member', 'aprovado, entra com o cargo do convite');
select ok((select count(*) from public.team_audit where action in ('invite_created', 'member_joined', 'join_approved')) >= 5,
  'convites e entradas ficam no log do time');

select * from finish();
rollback;
