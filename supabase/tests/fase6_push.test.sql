-- Fase 6: tokens de push e o disparo para a Edge Function. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.register_push_token('ExponentPushToken[ana-celular]', 'android') $$, 'registra o aparelho');
select is((select count(*)::int from public.push_tokens), 1, 'vê o próprio token');
select throws_ok($$ insert into public.push_tokens (user_id, token, platform) values (auth.uid(), 'ExponentPushToken[x]', 'ios') $$,
  '42501', null, 'não grava direto (só pela função)');
select throws_ok($$ select * from public.app_config $$, '42501', null, 'configuração do push é do servidor');

-- O mesmo celular, agora com a conta da Bia: o token muda de dono
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.register_push_token('ExponentPushToken[ana-celular]', 'android');
reset role;
select is((select user_id::text from public.push_tokens), '22222222-2222-2222-2222-222222222222',
  'trocar de conta no aparelho move o token');

-- Sem configuração, nada sai; com ela, a notificação vira uma chamada para a função
create temp table before_count on commit drop as select count(*) as n from net.http_request_queue;
insert into public.notifications (user_id, kind, payload) values ('22222222-2222-2222-2222-222222222222', 'member_joined', '{}');
select is((select count(*) from net.http_request_queue), (select n from before_count), 'sem configuração, não chama');
insert into public.app_config values ('push_url', 'http://localhost/functions/v1/push'), ('push_secret', 'segredo');
insert into public.notifications (user_id, kind, payload) values ('22222222-2222-2222-2222-222222222222', 'member_joined', '{}');
select is((select count(*) from net.http_request_queue), (select n + 1 from before_count), 'com configuração, chama a função');
insert into public.notifications (user_id, kind, payload) values ('11111111-1111-1111-1111-111111111111', 'member_joined', '{}');
select is((select count(*) from net.http_request_queue), (select n + 1 from before_count), 'quem não tem aparelho não gera chamada');

select * from finish();
rollback;
