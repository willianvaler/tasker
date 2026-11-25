-- ESCOPO_V14 (AU2): emissão, fila, reivindicação e passo idempotente do executor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'membro@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'sem-regra@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Aviso',
   '{"v": 1, "gatilho": {"tipo": "nivel.subiu"}, "passos": [{"tipo": "notificar", "titulo": "Subiu", "corpo": "Parabéns", "canal": "app"}]}');
insert into public.automation_rules (id, scope, folder_id, name, definition) values
  ('d0000000-0000-0000-0000-000000000002', 'projeto', 'aaaaaaaa-0000-0000-0000-000000000001', 'Projeto',
   '{"v": 1, "gatilho": {"tipo": "tarefa.concluida"}, "passos": [{"tipo": "notificar", "corpo": "Feita"}]}');
-- Regra antiga (D143): fica no caminho síncrono
insert into public.automation_rules (id, folder_id, trigger, action, params) values
  ('d0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify', '{"message": "x"}');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');

-- Emissão: sem regra, nada é gravado
select is(public.automation_emit('nivel.subiu', '{}', '33333333-3333-3333-3333-333333333333'), null,
  'pessoa sem regra ativa: nada é gravado');
select is(public.automation_emit('boss.derrotado', '{}', '11111111-1111-1111-1111-111111111111'), null,
  'regra de outro gatilho não conta');
select is((select count(*)::int from public.automation_events), 0, 'a fila continua vazia');
select set_config('questlist.bulk', '1', true);
select is(public.automation_emit('nivel.subiu', '{}', '11111111-1111-1111-1111-111111111111'), null,
  'importação em massa não emite');
select set_config('questlist.bulk', '', true);

select isnt(public.automation_emit('nivel.subiu', '{"nivel": 5}', '11111111-1111-1111-1111-111111111111', null, 'n|5'), null,
  'com regra ativa, o evento entra na fila');
select is(public.automation_emit('nivel.subiu', '{"nivel": 5}', '11111111-1111-1111-1111-111111111111', null, 'n|5'), null,
  'a mesma dedupe_key não entra duas vezes');
select isnt(public.automation_emit('tarefa.concluida', '{}', null, 'aaaaaaaa-0000-0000-0000-000000000001'), null,
  'regra de projeto no formato novo recebe evento');

-- Reivindicar: uma execução por regra e evento; a regra antiga fica de fora
create temp table claimed as select jsonb_array_elements(public.automation_claim(20)) as r;
select is((select count(*)::int from claimed), 2, 'duas execuções reivindicadas');
select is((select count(*)::int from public.automation_runs where rule_id = 'd0000000-0000-0000-0000-000000000003'), 0,
  'a regra antiga (D143) não roda pelo motor novo');
select is((select count(*)::int from public.automation_events where processed_at is null), 0, 'os eventos foram processados');
select is(jsonb_array_length(public.automation_claim(20)), 0, 'execução em andamento não é reivindicada de novo');

-- O mesmo evento entregue de novo não gera outra execução
update public.automation_events set processed_at = null;
select is(jsonb_array_length(public.automation_claim(20)), 0, 'evento entregue duas vezes: nenhuma execução nova');
select is((select count(*)::int from public.automation_runs), 2, 'continuam duas execuções');

-- Passo com efeito: sai uma vez
create temp table pessoal as select r from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000001';
select is(public.automation_step((select (r ->> 'id')::uuid from pessoal), (select (r ->> 'claimed_at')::timestamptz from pessoal),
  0, 1, '{"evento": {}, "var": {}}', '{"tipo": "notificacao", "titulo": "Subiu", "corpo": "Parabéns", "canal": "app", "para": "dona"}',
  '{"caminho": "0", "tipo": "notificar", "ok": true}', '[]', 'ok'), 'ok', 'passo gravado');
select is(public.automation_step((select (r ->> 'id')::uuid from pessoal), (select (r ->> 'claimed_at')::timestamptz from pessoal),
  0, 1, '{"evento": {}, "var": {}}', '{"tipo": "notificacao", "titulo": "Subiu", "corpo": "Parabéns", "canal": "app", "para": "dona"}',
  null, '[]', 'ok'), 'ignorado', 'o mesmo passo de novo é ignorado');
select is((select count(*)::int from public.notifications where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'automation'),
  1, 'uma notificação só');
select is((select payload ->> 'push' from public.notifications where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'automation'),
  'false', 'canal "app": não vai para o celular');
select is((select status || ':' || jsonb_array_length(steps) from public.automation_runs
  where rule_id = 'd0000000-0000-0000-0000-000000000001'), 'ok:1', 'execução terminada com o passo no histórico');
select is((select runs from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'), 1, 'a regra conta a execução');

-- Reivindicação velha (outro executor pegou depois) não grava
select is(public.automation_step((select (r ->> 'id')::uuid from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000002'),
  now() - interval '1 hour', 0, 1, '{}', '{"tipo": "notificacao", "corpo": "x", "para": "dona"}', null, '[]', 'ok'),
  'ignorado', 'reivindicação que não é a atual é ignorada');

-- Efeito com erro: a execução falha e a regra soma a falha
select is(public.automation_step((select (r ->> 'id')::uuid from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000002'),
  (select (r ->> 'claimed_at')::timestamptz from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000002'),
  0, 1, '{}', '{"tipo": "rodar_js"}', null, '[]', 'ok'), 'falhou', 'efeito desconhecido falha');
select is((select consecutive_failures from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000002'), 1,
  'e conta como falha seguida');

-- Executar agora e o que o cliente não chama
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.automation_run_now('d0000000-0000-0000-0000-000000000002') $$, '42501', null,
  'leitor não executa a regra do projeto');
select throws_ok($$ select public.automation_claim(1) $$, '42501', null, 'cliente não reivindica execuções');

select * from finish();
rollback;
