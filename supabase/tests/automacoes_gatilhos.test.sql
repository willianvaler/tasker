-- ESCOPO_V14 (AU3): de onde nascem os eventos dos gatilhos e a validação das condições prontas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
-- Começa com a fila vazia (o banco local guarda o que os E2E deixaram; tudo volta no rollback)
delete from public.automation_runs;
delete from public.automation_events;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'membro@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Semana');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;

-- Uma regra pessoal por gatilho e uma de projeto (todas só avisam)
insert into public.automation_rules (scope, name, definition)
select 'pessoal', g, jsonb_build_object('v', 1, 'gatilho', jsonb_build_object('tipo', g),
  'passos', jsonb_build_array(jsonb_build_object('tipo', 'notificar', 'corpo', '{{evento.titulo}}')))
from unnest(array['tarefa.criada', 'tarefa.concluida', 'lista.concluida', 'marco.atingido', 'nivel.subiu', 'boss.derrotado']) g;
insert into public.automation_rules (scope, folder_id, name, definition) values
  ('projeto', 'aaaaaaaa-0000-0000-0000-000000000001', 'Atribuída',
   '{"v": 1, "gatilho": {"tipo": "tarefa.atribuida"}, "passos": [{"tipo": "notificar", "corpo": "x"}]}');

-- Tarefa criada e concluída (a última da lista: a lista também)
insert into public.tasks (id, page_id, title, labels, due_date) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Lavar o carro', '{rua}', '2026-12-05');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'tarefa.criada'), 1, 'tarefa criada emite');
select is((select payload ->> 'titulo' || '|' || (payload -> 'etiquetas' ->> 0) || '|' || (payload ->> 'vencimento')
  from public.automation_events where kind = 'tarefa.criada'), 'Lavar o carro|rua|2026-12-05', 'com título, etiquetas e vencimento');
select is((select payload ->> 'projeto_nome' || '|' || (payload ->> 'lista_nome') from public.automation_events where kind = 'tarefa.criada'),
  'Casa|Semana', 'e os nomes do projeto e da lista');
select is((select owner_id::text from public.automation_events where kind = 'tarefa.criada'),
  '11111111-1111-1111-1111-111111111111', 'a dona do evento é quem fez');
set local role authenticated;
select public.complete_task('c0000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'tarefa.concluida'), 1, 'tarefa concluída emite');
select ok((select payload ? 'concluida_em' from public.automation_events where kind = 'tarefa.concluida'), 'com a hora da conclusão');
select is((select count(*)::int from public.automation_events where kind = 'lista.concluida'), 1, 'lista inteira concluída emite');

-- Atribuída: a regra de projeto recebe; a pessoa é quem recebeu
set local role authenticated;
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Varrer');
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');
reset role;
select is((select payload ->> 'pessoa' from public.automation_events where kind = 'tarefa.atribuida'),
  '22222222-2222-2222-2222-222222222222', 'tarefa atribuída emite, com a pessoa');
select is((select folder_id::text from public.automation_events where kind = 'tarefa.atribuida'),
  'aaaaaaaa-0000-0000-0000-000000000001', 'para o projeto');

-- Marco atingido
set local role authenticated;
insert into public.milestones (id, folder_id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Mudança');
update public.milestones set done_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
reset role;
select is((select payload ->> 'marco_nome' from public.automation_events where kind = 'marco.atingido'), 'Mudança',
  'marco atingido emite');

-- Nível e boss (o motor só lê o jogo)
update public.profiles set level = level + 1 where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.automation_events where kind = 'nivel.subiu'), 1, 'subir de nível emite');
update public.profiles set level = level - 1 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set level = level + 1 where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.automation_events where kind = 'nivel.subiu'), 1, 'o mesmo nível não emite de novo');
insert into public.bosses (id, scope, scope_id, name, icon, period_key, max_hp, hp, starts_at, ends_at) values
  ('f0000000-0000-0000-0000-000000000001', 'user', '11111111-1111-1111-1111-111111111111', 'Dragão', 'x', 'p', 10, 0,
   now(), now() + interval '1 day');
update public.bosses set status = 'defeated', defeated_at = now() where id = 'f0000000-0000-0000-0000-000000000001';
select is((select payload ->> 'boss_nome' from public.automation_events where kind = 'boss.derrotado'), 'Dragão',
  'boss derrotado emite');

-- Quem não tem regra não grava nada; o membro sem regra concluindo não emite
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task('c0000000-0000-0000-0000-000000000002');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'tarefa.concluida'), 1,
  'pessoa sem regra: nada gravado');

-- Modelo e importação não emitem
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_from_template('Importado', null,
  '{"pages": [{"name": "L", "tasks": [{"title": "A"}, {"title": "B"}, {"title": "C"}]}]}', false, true);
reset role;
select is((select count(*)::int from public.automation_events where kind = 'tarefa.criada'), 2,
  'importar e usar modelo não emitem tarefa criada (só as duas criadas à mão)');
select is(current_setting('questlist.bulk', true), '1', 'a transação ficou marcada como importação');
select set_config('questlist.bulk', '', true);

-- Condições prontas com parâmetros validados
set local role authenticated;
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "condicoes": {"pronta": "janela_horario", "de": "22h", "ate": "06:00"},
    "passos": [{"tipo": "parar"}]}') $$, '22023', null, 'janela de horário inválida');
select throws_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'X',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "condicoes": {"pronta": "dias_semana", "dias": [7]}, "passos": [{"tipo": "parar"}]}') $$,
  '22023', null, 'dia da semana inválido');
select lives_ok($$ insert into public.automation_rules (scope, name, definition) values ('pessoal', 'Noite',
  '{"v": 1, "gatilho": {"tipo": "manual"}, "condicoes": {"e": [{"pronta": "janela_horario", "de": "22:00", "ate": "06:00"},
    {"pronta": "etiqueta", "etiqueta": "casa"}, {"pronta": "nivel_min", "nivel": 3}]}, "passos": [{"tipo": "parar"}]}') $$,
  'condições prontas válidas');
reset role;
select is((select count(*)::int from public.automation_events where kind = 'tarefa.atribuida'), 1,
  'continua uma atribuição só');

select * from finish();
rollback;
