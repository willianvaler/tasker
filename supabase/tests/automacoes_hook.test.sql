-- ESCOPO_V14 (AU9): webhook de entrada com token, troca, assinatura e limites do corpo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
delete from public.automation_events;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Entrada',
   '{"v": 1, "gatilho": {"tipo": "webhook"}, "passos": [{"tipo": "notificar", "corpo": "{{hook.nome}}"}]}'),
  ('d0000000-0000-0000-0000-000000000002', 'pessoal', 'Manual',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}');
create temp table tk as select public.automation_hook_create('d0000000-0000-0000-0000-000000000001') as t;
select ok((select t ~ '^[0-9a-f]{64}$' from tk), 'o token sai uma vez, com 32 bytes');
select throws_ok($$ select public.automation_hook_create('d0000000-0000-0000-0000-000000000002') $$, '22023', null,
  'só para regra com o gatilho de chamada de fora');
select throws_ok($$ select public.automation_hook_fire('x', '{}') $$, '42501', null, 'quem tem login não chama direto');
reset role;
select is((select count(*)::int from public.automation_hooks where token_hash = (select t from tk)), 0, 'o banco guarda só o hash');
grant select on tk to anon;

set local role anon;
select public.automation_hook_fire((select t from tk), '{"nome": "Ana"}');
reset role;
select is((select payload #>> '{hook,nome}' from public.automation_events where kind = 'webhook'), 'Ana', 'token válido vira evento com hook.*');
set local role anon;
select public.automation_hook_fire(repeat('a', 64), '{"nome": "x"}');
select public.automation_hook_fire((select t from tk), '{"a": {"b": {"c": {"d": {"e": 1}}}}}');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'webhook'), 1, 'token errado e corpo fundo demais: nada');

-- Trocar o endereço invalida o antigo na hora
set local role authenticated;
create temp table tk2 as select public.automation_hook_create('d0000000-0000-0000-0000-000000000001') as t;
reset role;
grant select on tk2 to anon;
set local role anon;
select public.automation_hook_fire((select t from tk), '{"nome": "velho"}');
select public.automation_hook_fire((select t from tk2), '{"nome": "novo"}');
reset role;
select is((select string_agg(payload #>> '{hook,nome}', ',' order by payload #>> '{hook,nome}') from public.automation_events where kind = 'webhook'),
  'Ana,novo', 'o token antigo deixou de valer');

-- Regra desligada: responde igual e não grava
update public.automation_rules set enabled = false where id = 'd0000000-0000-0000-0000-000000000001';
set local role anon;
select public.automation_hook_fire((select t from tk2), '{"nome": "desligada"}');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'webhook'), 2, 'regra desligada não recebe');
update public.automation_rules set enabled = true where id = 'd0000000-0000-0000-0000-000000000001';

-- Exigir assinatura: sem ela, nada; com o HMAC certo, entra
set local role authenticated;
create temp table seg as select public.automation_signing_secret('d0000000-0000-0000-0000-000000000001') as s;
select public.automation_hook_require_signature('d0000000-0000-0000-0000-000000000001', true);
reset role;
grant select on seg to anon;
set local role anon;
select public.automation_hook_fire((select t from tk2), '{"nome": "sem"}', '{"nome": "sem"}', null);
select public.automation_hook_fire((select t from tk2), '{"nome": "errada"}', '{"nome": "errada"}', 't=1,v1=' || repeat('0', 64));
reset role;
select is((select count(*)::int from public.automation_events where kind = 'webhook'), 2, 'sem assinatura ou com a errada: nada');
create temp table ts as select extract(epoch from now())::bigint::text as t;
grant select on ts to anon;
set local role anon;
select public.automation_hook_fire((select t from tk2), '{"nome": "assinado"}', '{"nome": "assinado"}',
  't=' || (select t from ts) || ',v1=' || encode(extensions.hmac((select t from ts) || '.{"nome": "assinado"}', (select s from seg), 'sha256'), 'hex'));
reset role;
select ok(exists (select 1 from public.automation_events where kind = 'webhook' and payload #>> '{hook,nome}' = 'assinado'),
  'com a assinatura certa, entra');
select isnt((select last_used_at from public.automation_hooks where rule_id = 'd0000000-0000-0000-0000-000000000001'), null, 'o último uso fica registrado');

-- Corpo acima de 16 KB não entra
update public.automation_hooks set require_signature = false where rule_id = 'd0000000-0000-0000-0000-000000000001';
set local role anon;
select public.automation_hook_fire((select t from tk2), jsonb_build_object('x', repeat('a', 17000)));
reset role;
select is((select count(*)::int from public.automation_events where kind = 'webhook'), 3, 'corpo acima de 16 KB: nada');
select is(public._jsonb_depth('{"a": {"b": [1, {"c": 2}]}}'), 4, 'a profundidade conta objetos e listas');

select * from finish();
rollback;
