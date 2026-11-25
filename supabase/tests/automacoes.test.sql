-- V3 §2.8 (M6): automações "quando… então…" do projeto (D143). Desde o AU5 (D337) elas rodam pelo
-- motor do V14: o gatilho vira evento, a reivindicação vira execução e o passo, o efeito.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
delete from public.automation_runs;
delete from public.automation_events;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dia'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Depois');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assar a carne'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Pagar o açougue');

insert into public.automation_rules (id, folder_id, page_id, trigger, action, params) values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'task_done', 'create_task', '{"title": "Limpar a churrasqueira", "page_id": "bbbbbbbb-0000-0000-0000-000000000002"}'),
  ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', null,
   'page_done', 'notify', '{"to": "creator", "message": "Dia fechado"}');

-- Concluir em "Dia": a regra da lista e a da lista inteira viram execução no motor
select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000001') $$, 'concluir funciona');
reset role;
create temp table claimed as select jsonb_array_elements(public.automation_claim(20)) as r;
select is((select count(*)::int from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000001'), 1,
  'a regra antiga roda pelo motor novo');
select is((select r #>> '{definition,passos,0,tipo}' from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000001'),
  'criar_tarefa', 'com a definição traduzida');
select is((select count(*)::int from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000002'), 1,
  'a lista "Dia" inteira concluída também dispara');
create temp table dia as select r from claimed where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000001';

-- O passo cria a tarefa seguinte e a tela antiga vê o registro
select is(public.automation_step((select (r ->> 'id')::uuid from dia), (select (r ->> 'claimed_at')::timestamptz from dia),
  0, 1, (select r -> 'state' from dia),
  '{"tipo": "criar_tarefa", "titulo": "Limpar a churrasqueira", "lista": "bbbbbbbb-0000-0000-0000-000000000002"}',
  '{"caminho": "0", "tipo": "criar_tarefa", "ok": true}', '[]', 'ok'), 'ok', 'o passo roda');
select is((select count(*)::int from public.tasks where title = 'Limpar a churrasqueira' and page_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  1, 'a automação criou a tarefa seguinte');
select is((select ok from public.automation_log where rule_id = 'd0000000-0000-0000-0000-000000000001'), true,
  'e a tela antiga vê a execução no automation_log');
select is((select runs from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'), 1, 'a regra conta a execução');

-- Concluir em "Depois" não dispara a regra que é só de "Dia"
set local role authenticated;
select public.complete_task('c0000000-0000-0000-0000-000000000002');
reset role;
select is((select count(*)::int from jsonb_array_elements(public.automation_claim(20)) x
  where x ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000001'), 0, 'a regra da lista "Dia" não roda em "Depois"');

-- O aviso da regra antiga sai no formato de antes (sem rule_id: "mensagem: tarefa")
select is(public._automation_effect(
  (select x from public.automation_runs x limit 1),
  (select r from public.automation_rules r where id = 'd0000000-0000-0000-0000-000000000002'),
  '{"tipo": "notificacao", "corpo": "Dia fechado", "para": "dona"}'), null, 'aviso da regra antiga');
select ok((select not payload ? 'rule_id' from public.notifications where kind = 'automation' and payload ->> 'message' = 'Dia fechado'),
  'no formato antigo');
set local role authenticated;

-- Leitor não cria; limite de 20
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ insert into public.automation_rules (folder_id, trigger, action) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify') $$, '42501', null, 'Leitor não cria automação');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ insert into public.automation_rules (folder_id, trigger, action)
  select 'aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify' from generate_series(1, 20) $$,
  '22023', null, 'no máximo 20 por projeto');

select * from finish();
rollback;
