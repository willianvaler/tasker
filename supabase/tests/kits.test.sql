-- PB6 (D301): kit pronto com etapas em ordem (deps) e página de gastos com orçamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'outra@teste.local');

-- Uma tarefa de fora, de outra pessoa, para a dependência que não pode pegar
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000009', 'Dela', 'folder');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009', 'Lista');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000009',
  '[{"id": "eeeeeeee-0000-0000-0000-000000000009", "title": "De fora"}]');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table kit as select public.create_from_template('Reforma', '🔨', $j${
  "pages": [
    {"name": "Etapas", "view_type": "list", "reset_cycle": "none", "budget_cents": 999, "items": [
      {"id": "eeeeeeee-0000-0000-0000-000000000001", "title": "Orçar"},
      {"id": "eeeeeeee-0000-0000-0000-000000000002", "title": "Comprar"},
      {"id": "eeeeeeee-0000-0000-0000-000000000003", "title": "Pintar"}]},
    {"name": "Orçamento", "view_type": "expenses", "reset_cycle": "none", "budget_cents": 1500000,
     "items": [{"title": "não entra"}]}
  ],
  "deps": [
    {"task": "eeeeeeee-0000-0000-0000-000000000002", "on": "eeeeeeee-0000-0000-0000-000000000001"},
    {"task": "eeeeeeee-0000-0000-0000-000000000003", "on": "eeeeeeee-0000-0000-0000-000000000002"},
    {"task": "eeeeeeee-0000-0000-0000-000000000003", "on": "eeeeeeee-0000-0000-0000-000000000009"},
    {"task": "eeeeeeee-0000-0000-0000-000000000001", "on": "eeeeeeee-0000-0000-0000-000000000001"}
  ]}$j$::jsonb, true) as id;

select is((select count(*)::int from public.tasks where folder_id = (select id from kit)), 3,
  'as três etapas nascem; a página de gastos não recebe tarefas');
select is((select count(*)::int from public.task_dependencies where folder_id = (select id from kit)), 2,
  'só as dependências entre tarefas do kit');
select ok(exists(select 1 from public.task_dependencies
  where task_id = 'eeeeeeee-0000-0000-0000-000000000003' and depends_on_task_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'Pintar depende de Comprar');
select is((select count(*)::int from public.task_dependencies where depends_on_task_id = 'eeeeeeee-0000-0000-0000-000000000009'), 0,
  'tarefa de outra pessoa não vira pré-requisito');
select is((select budget_cents from public.pages where folder_id = (select id from kit) and view_type = 'expenses'),
  1500000::bigint, 'a página de gastos nasce com o orçamento');
select is((select budget_cents from public.pages where folder_id = (select id from kit) and view_type = 'list'),
  null, 'lista comum não guarda orçamento');
select is(public.task_state('eeeeeeee-0000-0000-0000-000000000002'), 'blocked', 'Comprar espera o Orçar');

select throws_ok($$ select public.create_from_template('X', '', jsonb_build_object(
  'pages', '[{"name": "A", "items": []}]'::jsonb,
  'deps', (select jsonb_agg(jsonb_build_object('task', g, 'on', g)) from generate_series(1, 301) g))) $$,
  '22023', null, 'no máximo 300 dependências');

select * from finish();
rollback;
