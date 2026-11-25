-- ESCOPO_V14 (AU8): webhook de saída, validação do passo e segredos no Vault.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok($$ insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Discord',
   '{"v": 1, "gatilho": {"tipo": "nivel.subiu"}, "passos": [{"tipo": "enviar_webhook", "url": "https://discord.com/api/webhooks/1/x",
     "cabecalhos": {"Authorization": {"segredo": "token"}, "X-Ola": "oi"}, "corpo": {"content": "Nível {{evento.nivel}}"}, "assinar": true}]}') $$,
  'webhook válido');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "enviar_webhook", "url": "http://exemplo.com"}]}') $$,
  '22023', 'Webhook: só endereços https://', 'só https');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "enviar_webhook", "url": "https://x.com", "cabecalhos": {"Host": "a"}}]}') $$,
  '22023', 'Webhook: cabeçalho não permitido: Host', 'Host não');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "enviar_webhook", "url": "https://x.com", "cabecalhos": {"X-Questlist-Signature": "a"}}]}') $$,
  '22023', 'Webhook: cabeçalho não permitido: X-Questlist-Signature', 'nem X-Questlist-*');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "enviar_webhook", "url": "https://x.com", "metodo": "TRACE"}]}') $$,
  '22023', null, 'método fora da lista');

-- Segredos: guardar, ver só os nomes, assinatura uma vez
select lives_ok($$ select public.automation_secret_set('d0000000-0000-0000-0000-000000000001', 'token', 'Bearer abc123') $$,
  'a dona guarda o segredo');
select ok(public.automation_signing_secret('d0000000-0000-0000-0000-000000000001') like 'whsec_%', 'o segredo de assinatura sai uma vez');
select is(public.automation_secret_names('d0000000-0000-0000-0000-000000000001'), array['_assinatura', 'token'], 'só os nomes voltam');
select throws_ok($$ select * from public.automation_secrets $$, '42501', null, 'cliente não lê a tabela dos segredos');
select throws_ok($$ select public.automation_run_secrets(gen_random_uuid()) $$, '42501', null, 'nem a função do executor');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.automation_secret_set('d0000000-0000-0000-0000-000000000001', 'token', 'roubado') $$,
  '42501', null, 'estranho não troca o segredo');
reset role;

-- O executor recebe os valores; apagar a regra apaga do Vault
insert into public.automation_runs (id, rule_id, event_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', gen_random_uuid());
select is(public.automation_run_secrets('e0000000-0000-0000-0000-000000000001') ->> 'token', 'Bearer abc123',
  'o executor lê o valor');
create temp table cofre as select secret_id from public.automation_secrets;
delete from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from vault.secrets where id in (select secret_id from cofre)), 0, 'apagar a regra apaga do Vault');
select is((select count(*)::int from public.automation_secrets), 0, 'e da tabela');

select * from finish();
rollback;
