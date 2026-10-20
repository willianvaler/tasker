-- ESCOPO_V10 AM1 (D230): nick, pedidos de amizade por nick, e-mail e link.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"display_name": "Ana Souza"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{"display_name": "Bia"}'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local', '{"display_name": "Ana Souza"}'),
  ('44444444-4444-4444-4444-444444444444', 'zé@teste.local', '{"display_name": "Zé"}');

-- Nick sugerido do nome, sem acento, sem repetir
select is((select username from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'ana.souza', 'nick do nome');
select is((select username from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 'ana.souza2', 'repetido ganha número');
select is((select username from public.profiles where id = '44444444-4444-4444-4444-444444444444'), 'ze.user', 'nome curto completa');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.set_username('@Ana_S'), 'ana_s', 'troca o nick (minúsculas, sem @)');
select throws_ok($$ select public.set_username('ab') $$, '22023', null, 'nick curto não');
select throws_ok($$ select public.set_username('bia') $$, '23505', null, 'nick de outra pessoa não');
select throws_ok($$ update public.profiles set username = 'x.y.z' where id = auth.uid() $$, '42501', null,
  'nick só pela RPC');

-- Por nick: pedido pendente, Bia é avisada
select is(public.friend_request('bia'), 'sent', 'pede por nick');
select is(public.friend_request('bia'), 'already', 'de novo: já pedido');
select is(public.friend_request('ninguem.aqui'), 'not_found', 'nick que não existe');
select is(public.friend_request('ana_s'), 'self', 'a mim mesma não');
select is(public.are_friends('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'), false,
  'pendente ainda não é amizade');

-- Por e-mail: não revela se a conta existe
select is(public.friend_request(null, 'naoexiste@teste.local'), 'sent', 'e-mail sem conta responde igual');
select is(public.friend_request(null, 'CAIO@teste.local'), 'sent', 'e-mail com conta (sem diferenciar caixa)');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'friend_request'), 1, 'Bia recebe o aviso');
select is((select incoming from public.my_friends() where username = 'ana_s'), true, 'pedido recebido aparece');
select lives_ok($$ select public.friend_respond('11111111-1111-1111-1111-111111111111', true) $$, 'Bia aceita');
select is(public.are_friends('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'), true,
  'agora são amigas');
select throws_ok($$ select public.friend_respond('11111111-1111-1111-1111-111111111111', true) $$, 'P0002', null,
  'aceitar de novo não');

-- Caio recusa
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.friend_respond('11111111-1111-1111-1111-111111111111', false);
select is((select count(*)::int from public.friendships), 0, 'recusado some (Caio não vê mais nada)');

-- Link: Zé entra pelo link da Bia e vira amigo na hora
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table link as select public.friend_link() as token;
grant select on link to authenticated, anon;
select is(public.friend_link(), (select token from link), 'o mesmo link até trocar');
set local role anon;
select is((select username from public.friend_link_preview((select token from link))), 'bia', 'prévia sem login');
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok($$ select public.friend_link_accept((select token from link)) $$, 'entra pelo link');
select is(public.are_friends('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444'), true,
  'amizade na hora');

-- Bia troca o link: o antigo para de valer; desfazer amizade
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select isnt(public.friend_link(true), (select token from link), 'link trocado');
select public.friend_remove('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.my_friends()), 1, 'desfeita: sobra só a Ana');

select * from finish();
rollback;
