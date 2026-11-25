-- ESCOPO_V16 (PR1): definições versionadas, instância presa à versão, o que o cliente não escreve.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000001', 'Aprovação',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "f", "tipo": "fim"}], "arestas": [{"id": "a", "de": "i", "para": "f"}]}');
select isnt(public.process_publish('d0000000-0000-0000-0000-000000000001'), null, 'publica a versão 1');
create temp table inst1 as select public.process_start('d0000000-0000-0000-0000-000000000001') as id;
select is((select v.number from public.process_instances i join public.process_versions v on v.id = i.version_id
  where i.id = (select id from inst1)), 1, 'a instância nasce na versão 1');

update public.process_definitions set draft =
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "t", "tipo": "temporizador", "duracao": "PT1H"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "a", "de": "i", "para": "t"}, {"id": "b", "de": "t", "para": "f"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select public.process_publish('d0000000-0000-0000-0000-000000000001');
select is((select v.number from public.process_instances i join public.process_versions v on v.id = i.version_id
  where i.id = (select id from inst1)), 1, 'depois da versão 2, a instância antiga continua na 1');
select is((select count(*)::int from public.process_versions where definition_id = 'd0000000-0000-0000-0000-000000000001'), 2,
  'duas versões');

-- Versão publicada não muda
select throws_ok($$ update public.process_versions set graph = '{}' $$, '42501', null, 'o cliente não muda versão');
reset role;
select throws_ok($$ update public.process_versions set graph = '{}' $$, '42501', 'Versão publicada não muda: publique uma nova',
  'nem o servidor');
set local role authenticated;

-- O que só o servidor escreve
select throws_ok($$ insert into public.process_steps (instance_id, node_id, node_type, status)
  values ((select id from inst1), 'i', 'inicio', 'ok') $$, '42501', null, 'cliente não grava passo');
select throws_ok($$ insert into public.process_tokens (instance_id, node_id) values ((select id from inst1), 'i') $$,
  '42501', null, 'nem token');
select throws_ok($$ insert into public.process_waits (instance_id, token_id, kind)
  values ((select id from inst1), gen_random_uuid(), 'mensagem') $$, '42501', null, 'nem espera');
select throws_ok($$ update public.process_instances set status = 'concluida' $$, '42501', null, 'nem muda a instância');

-- Validação ao publicar
update public.process_definitions set draft =
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "j", "tipo": "inicio"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "a", "de": "i", "para": "f"}, {"id": "b", "de": "j", "para": "f"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000001') $$, '22023',
  'O processo precisa de um início, e só um', 'dois inícios');
update public.process_definitions set draft =
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "x", "tipo": "xor", "nome": "Decide"}, {"id": "f", "tipo": "fim"}, {"id": "g", "tipo": "fim"}],
    "arestas": [{"id": "a", "de": "i", "para": "x"}, {"id": "b", "de": "x", "para": "f", "condicao": "1"}, {"id": "c", "de": "x", "para": "g", "condicao": "0"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000001') $$, '22023',
  'Portão de decisão sem caminho padrão: Decide', 'XOR sem padrão, apontando o nó');
update public.process_definitions set draft =
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "s", "tipo": "servico", "nome": "Solto"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "a", "de": "i", "para": "f"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000001') $$, '22023',
  'Nó que nunca é alcançado: Solto', 'nó inalcançável');
update public.process_definitions set draft =
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "l", "tipo": "servico", "nome": "Gira"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "a", "de": "i", "para": "l"}, {"id": "b", "de": "l", "para": "l"}, {"id": "c", "de": "i", "para": "f"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000001') $$, '22023',
  'Nó sem caminho até um fim: Gira', 'laço sem saída');
update public.process_definitions set draft = jsonb_build_object('v', 1, 'arestas', '[]'::jsonb,
  'nos', (select jsonb_agg(jsonb_build_object('id', 'n' || g, 'tipo', 'fim')) from generate_series(1, 201) g))
where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000001') $$, '22023',
  'No máximo 200 nós por processo', 'mais de 200 nós');

-- Estranho não vê; cancelar encerra
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.process_instances), 0, 'estranho não vê instância');
select throws_ok($$ select public.process_cancel((select id from inst1)) $$, '42501', null, 'nem cancela');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.process_cancel((select id from inst1));
select is((select status from public.process_instances where id = (select id from inst1)), 'cancelada', 'a dona cancela');

-- Exportação da conta
select ok((select public.export_my_data() ? 'process_instances' and public.export_my_data() ? 'automation_rules'),
  'a exportação leva processos e automações');

select * from finish();
rollback;
