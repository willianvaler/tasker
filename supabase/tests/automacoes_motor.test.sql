-- ESCOPO_V14 (AU1): tabelas do motor de automações, validação no banco e o que o cliente não lê.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

-- Regra pessoal válida
select lives_ok($$ insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Desligar o ar',
   '{"v": 1, "gatilho": {"tipo": "horario", "hora": "22:30", "dias": ["1", "2"]},
     "condicoes": {"e": [{"pronta": "dias_semana", "dias": [1]}, {"campo": "evento.titulo", "op": "contem", "valor": "x"}]},
     "passos": [{"tipo": "notificar", "titulo": "Boa noite", "canal": "app"},
                {"tipo": "se", "condicao": {"nao": {"campo": "agora", "op": "vazio"}},
                 "entao": [{"tipo": "parar"}], "senao": [{"tipo": "esperar", "minutos": 5}]}]}') $$,
  'dona cria regra pessoal');
select is((select trigger_type from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'),
  'horario', 'o servidor guarda o tipo do gatilho');
select is((select owner_id::text from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111', 'a dona é quem criou');

-- Inválidas: recusadas pelo banco
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "rodar_js"}]}') $$,
  '22023', null, 'passo desconhecido');
select throws_ok($$ insert into public.automation_rules (scope, name, definition)
  select 'pessoal', 'X', jsonb_build_object('v', 1, 'gatilho', jsonb_build_object('tipo', 'manual'),
    'passos', (select jsonb_agg(jsonb_build_object('tipo', 'parar')) from generate_series(1, 21))) $$,
  '22023', null, 'mais de 20 passos');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": []}') $$, '22023', null, 'nenhum passo');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "atualizar_tarefa", "concluir": true}]}') $$,
  '22023', null, 'automação não conclui tarefa (V14-5)');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "horario", "hora": "25:00"}, "passos": [{"tipo": "parar"}]}') $$,
  '22023', null, 'horário inválido');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "se", "condicao": {"e": [{"e": [{"e": [{"nao": {"campo": "a", "op": "vazio"}}]}]}]}, "entao": [{"tipo": "parar"}]}]}') $$,
  '22023', null, 'condição com mais de 3 níveis');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "se", "condicao": {"campo": "a", "op": "=", "valor": 1},
    "entao": [{"tipo": "se", "condicao": {"campo": "a", "op": "=", "valor": 1},
      "entao": [{"tipo": "se", "condicao": {"campo": "a", "op": "=", "valor": 1},
        "entao": [{"tipo": "se", "condicao": {"campo": "a", "op": "=", "valor": 1}, "entao": [{"tipo": "parar"}]}]}]}]}]}') $$,
  '22023', null, 'SE aninhado mais de 3 níveis');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', '',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}') $$, '22023', null, 'sem nome');
select throws_ok($$ insert into public.automation_rules (scope, name, folder_id, definition) values ('pessoal', 'X',
  'aaaaaaaa-0000-0000-0000-000000000001', '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}') $$,
  '23514', null, 'regra pessoal não tem projeto');

-- Projeto: só os gatilhos e passos que não saem do app (D333)
select throws_ok($$ insert into public.automation_rules (scope, folder_id, name, definition) values ('projeto',
  'aaaaaaaa-0000-0000-0000-000000000001', 'X', '{"v": 1, "gatilho": {"tipo": "webhook"}, "passos": [{"tipo": "parar"}]}') $$,
  '22023', null, 'webhook não vale para regra de projeto');
select lives_ok($$ insert into public.automation_rules (scope, folder_id, name, definition) values ('projeto',
  'aaaaaaaa-0000-0000-0000-000000000001', 'Avisar', '{"v": 1, "gatilho": {"tipo": "tarefa.concluida"},
  "passos": [{"tipo": "notificar", "corpo": "Feita"}]}') $$, 'regra de projeto no formato novo');

-- Regra antiga (D143): a definição vem das colunas antigas
insert into public.automation_rules (id, folder_id, trigger, action, params) values
  ('d0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'task_overdue', 'add_label', '{"label": "#atrasada"}');
select is((select definition #>> '{gatilho,tipo}' from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000009'),
  'tarefa.atrasada', 'regra antiga ganha a definição nova');
select is((select definition #>> '{passos,0,adicionar_etiquetas,0}' from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000009'),
  'atrasada', 'com a ação traduzida');
select is((select name from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000009'),
  'Quando atrasa: pôr etiqueta', 'e um nome');

-- executar_regra: sem ciclo e só regra da mesma dona
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000002', 'pessoal', 'B',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "executar_regra", "regra": "d0000000-0000-0000-0000-000000000001"}]}');
select throws_ok($$ update public.automation_rules set definition =
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "se", "condicao": {"campo": "a", "op": "vazio"},
    "entao": [{"tipo": "executar_regra", "regra": "d0000000-0000-0000-0000-000000000002"}]}]}'
  where id = 'd0000000-0000-0000-0000-000000000001' $$, '22023', null, 'A chama B chama A é recusado');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "executar_regra", "regra": "d0000000-0000-0000-0000-000000000099"}]}') $$,
  '22023', null, 'regra chamada precisa existir');

-- Leitor do projeto vê a regra de projeto e não cria; estranho não vê nada
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.automation_rules where scope = 'projeto'), 2, 'leitor vê as regras do projeto');
select is((select count(*)::int from public.automation_rules where scope = 'pessoal'), 0, 'e não vê as pessoais da dona');
select throws_ok($$ insert into public.automation_rules (scope, folder_id, name, definition) values ('projeto',
  'aaaaaaaa-0000-0000-0000-000000000001', 'X', '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}') $$,
  '42501', null, 'leitor não cria regra de projeto');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.automation_rules), 0, 'estranho não vê regra nenhuma');
update public.automation_rules set name = 'invadida' where id = 'd0000000-0000-0000-0000-000000000001';
reset role;
select is((select name from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'),
  'Desligar o ar', 'estranho não altera');
set local role authenticated;

-- O que o cliente não lê nem grava
select throws_ok($$ select count(*) from public.automation_events $$, '42501', null, 'cliente não lê a fila de eventos');
select throws_ok($$ select count(*) from public.connector_secrets $$, '42501', null, 'cliente não lê os segredos');
select throws_ok($$ select count(*) from public.device_commands $$, '42501', null, 'cliente não lê os comandos');
select throws_ok($$ select token_hash from public.automation_hooks $$, '42501', null, 'nem o hash do webhook');
select throws_ok($$ insert into public.automation_runs (rule_id) values ('d0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'nem grava execução');

-- Dispositivo: a dona muda nome e sensível, não as capacidades
reset role;
insert into public.connectors (id, owner_id, kind, status) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'tuya', 'conectado');
insert into public.devices (id, owner_id, connector_id, external_id, name, category) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'e0000000-0000-0000-0000-000000000001', 'ext-1', 'Ar do quarto', 'ar_ir');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.devices set name = 'Ar', sensitive = true where id = 'f0000000-0000-0000-0000-000000000001';
select is((select name || ':' || sensitive from public.devices where id = 'f0000000-0000-0000-0000-000000000001'),
  'Ar:true', 'dona renomeia e marca sensível');
select throws_ok($$ update public.devices set capabilities = '{}' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'e não mexe nas capacidades');

select * from finish();
rollback;
