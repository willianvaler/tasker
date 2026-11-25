-- ESCOPO_V14 (AU7): editar a regra antiga no editor novo a converte; usuario.atrasadas no executor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
delete from public.automation_runs;
delete from public.automation_events;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'L');
insert into public.automation_rules (id, folder_id, trigger, action, params) values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify', '{"message": "x"}');

update public.automation_rules set definition =
  '{"v": 1, "gatilho": {"tipo": "tarefa.criada"}, "passos": [{"tipo": "notificar", "corpo": "nova"}]}'
where id = 'd0000000-0000-0000-0000-000000000001';
select is((select coalesce(trigger, '-') || '|' || coalesce(action, '-') from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000001'), '-|-', 'editada no editor novo, perde as colunas antigas');
select is((select trigger_type || '|' || (definition #>> '{passos,0,corpo}') from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000001'), 'tarefa.criada|nova', 'e fica com a definição nova');

-- A tela antiga continua mexendo nas antigas
insert into public.automation_rules (id, folder_id, trigger, action, params) values
  ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'add_label', '{"label": "a"}');
update public.automation_rules set params = '{"label": "b"}' where id = 'd0000000-0000-0000-0000-000000000002';
select is((select definition #>> '{passos,0,adicionar_etiquetas,0}' from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000002'), 'b', 'a tela antiga segue derivando a definição');

-- usuario.atrasadas: as tarefas atrasadas da dona
insert into public.tasks (page_id, title, due_date) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Velha', current_date - 3),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Hoje', current_date + 1);
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000003', 'pessoal', 'Atrasadas', '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}');
select public.automation_run_now('d0000000-0000-0000-0000-000000000003');
reset role;
create temp table c as select jsonb_array_elements(public.automation_claim(20)) as r;
select is((select (r #>> '{usuario,atrasadas}')::integer from c where r ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000003'), 1,
  'o executor recebe quantas estão atrasadas');
select is(public._automation_overdue_count('33333333-3333-3333-3333-333333333333', 'UTC'), 0, 'outra pessoa: zero');

select * from finish();
rollback;
