-- ESCOPO_V10 AM3 (D231): adicionar amigo direto em projeto, time e clã.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Viagem');
select public.friend_request('bia');
select public.friend_request('leitor');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.friend_respond('11111111-1111-1111-1111-111111111111', true);
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.friend_respond('11111111-1111-1111-1111-111111111111', true);

-- Projeto: pasta pessoal vira projeto e a amiga entra com o cargo pedido
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.add_friend_to_group('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001'),
  'added', 'amiga adicionada ao projeto');
select is(public.add_friend_to_group('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001'),
  'already', 'de novo: já está');
reset role;
select is((select kind || ':' || is_shared from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'project:true', 'a pasta virou projeto');
select is((select role::text from public.folder_members where user_id = '22222222-2222-2222-2222-222222222222'
  and folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'contributor', 'entra como Colaborador por padrão');
select is((select payload ->> 'group_name' from public.notifications
  where user_id = '22222222-2222-2222-2222-222222222222' and kind = 'added_to_group'), 'Viagem', 'a amiga é avisada');
set local role authenticated;
select throws_ok($$ select public.add_friend_to_group('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'quem não é amigo não entra');
select throws_ok($$ select public.add_friend_to_group('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000001', null, false, 'owner') $$,
  '22023', null, 'não dá o papel de dono');

-- Colaboradora não adiciona (não gerencia membros)
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.friend_request('leitor');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.friend_respond('22222222-2222-2222-2222-222222222222', true);
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.add_friend_to_group('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'colaboradora não adiciona ninguém');

-- Time: só quem administra
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.teams (id, name) values ('7ea70000-0000-0000-0000-000000000001', 'Família');
select is(public.add_friend_to_group('22222222-2222-2222-2222-222222222222', null, '7ea70000-0000-0000-0000-000000000001'), 'added',
  'amiga entra no time');
select ok(exists (select 1 from public.team_members where team_id = '7ea70000-0000-0000-0000-000000000001'
  and user_id = '22222222-2222-2222-2222-222222222222' and role = 'member'), 'como membro');

-- Clã: entra se não estiver em outro
select public.create_clan('Guilda', null);
select is(public.add_friend_to_group('44444444-4444-4444-4444-444444444444', null, null, true), 'added', 'amigo entra no clã');
select throws_ok($$ select public.add_friend_to_group('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', null, true) $$,
  '22023', null, 'um grupo por vez');

select * from finish();
rollback;
