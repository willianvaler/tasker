-- ESCOPO_V15 (CT4): gatilho por link (QR e NFC) com token, confirmação, troca e revogação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
delete from public.automation_events;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranha@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.automation_rules (id, scope, name, definition) values
  ('e0000000-0000-0000-0000-000000000001', 'pessoal', 'Cheguei',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "notificar", "corpo": "oi"}]}'),
  ('e0000000-0000-0000-0000-000000000002', 'pessoal', 'Avisar fora',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "enviar_webhook", "url": "https://discord.com/api/webhooks/1/x"}]}'),
  ('e0000000-0000-0000-0000-000000000003', 'pessoal', 'Horário',
   '{"v": 1, "gatilho": {"tipo": "horario", "hora": "08:00"}, "passos": [{"tipo": "parar"}]}');

create temp table tk as select public.automation_link_create('e0000000-0000-0000-0000-000000000001') as t;
create temp table tx as select public.automation_link_create('e0000000-0000-0000-0000-000000000002') as t;
select ok((select t ~ '^[0-9a-f]{64}$' from tk), 'o token sai uma vez, com 32 bytes');
select throws_ok($$ select public.automation_link_create('e0000000-0000-0000-0000-000000000003') $$, '22023', null,
  'só regra com gatilho manual tem link');
reset role;
select is((select count(*)::int from public.automation_links where token_hash = (select t from tk)), 0, 'o banco guarda só o hash');
grant select on tk, tx to authenticated, anon;
set local role authenticated;

-- Abrir: o que a tela mostra
select is(public.automation_link_open((select t from tk)) ->> 'nome', 'Cheguei', 'a dona abre o link e vê a regra');
select is((public.automation_link_open((select t from tk)) ->> 'confirmar')::boolean, true, 'pede confirmação por padrão');
select is((public.automation_link_open((select t from tx)) ->> 'externo')::boolean, true, 'regra com webhook é externa');

-- Executar: sem confirmar, recusa; confirmando, vira evento manual
select throws_ok($$ select public.automation_link_fire((select t from tk)) $$, '22023', null, 'sem confirmar, não roda');
select public.automation_link_fire((select t from tk), true);
reset role;
select is((select count(*)::int from public.automation_events where kind = 'manual'
            and payload ->> 'regra' = 'e0000000-0000-0000-0000-000000000001'), 1, 'confirmado, vira evento manual');
set local role authenticated;

-- A dona tira a confirmação: a regra comum roda direto, a externa continua pedindo
select public.automation_link_set_confirm('e0000000-0000-0000-0000-000000000001', false);
select public.automation_link_set_confirm('e0000000-0000-0000-0000-000000000002', false);
select lives_ok($$ select public.automation_link_fire((select t from tk)) $$, 'sem confirmação configurada, roda direto');
select throws_ok($$ select public.automation_link_fire((select t from tx)) $$, '22023', null,
  'webhook ou dispositivo sempre confirma (V15-19)');
reset role;
select is((select uses from public.automation_links where rule_id = 'e0000000-0000-0000-0000-000000000001'), 2, 'os usos são contados');
set local role authenticated;

-- Outra pessoa e quem não tem login não usam o link
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.automation_link_open((select t from tk)), '{"valido": false}'::jsonb, 'estranha não vê a regra pelo link');
select throws_ok($$ select public.automation_link_fire((select t from tk), true) $$, '42501', null, 'estranha não executa');
select is((select count(*)::int from public.automation_links), 0, 'estranha não lê a tabela');
reset role;
set local role anon;
select throws_ok($$ select public.automation_link_open((select t from tk)) $$, '42501', null, 'sem login, a RPC é fechada');
reset role;

-- Trocar e revogar valem na hora
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table tk2 as select public.automation_link_create('e0000000-0000-0000-0000-000000000001') as t;
select is((public.automation_link_open((select t from tk)) ->> 'valido')::boolean, false, 'trocar invalida o antigo');
select public.automation_link_revoke('e0000000-0000-0000-0000-000000000001');
select is((public.automation_link_open((select t from tk2)) ->> 'valido')::boolean, false, 'revogado deixa de valer na hora');

select * from finish();
rollback;
