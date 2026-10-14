begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d3', 'd3@teste.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'e3@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d3"}';

insert into public.folders (id, name) values ('00000000-0000-0000-0000-00000000f0d3', 'Pasta');
insert into public.pages (id, folder_id, name) values ('00000000-0000-0000-0000-00000000a0d3', '00000000-0000-0000-0000-00000000f0d3', 'Página');
select public.create_tasks_batch('00000000-0000-0000-0000-00000000a0d3',
  '[{"id": "01920000-0000-7000-8000-0000000000d3", "title": "Conta", "due_date": "2026-10-15", "recurrence": {"type": "monthly"}}]');

select public.run_once('01920000-0000-7000-8000-00000000c0d3', 'complete_task',
  '{"p_task_id": "01920000-0000-7000-8000-0000000000d3"}');
select is((select due_date from public.tasks where title = 'Conta'), '2026-11-15'::date,
  'concluir a recorrente avança a data');

select is(public.run_once('01920000-0000-7000-8000-00000000c0d3', 'complete_task',
  '{"p_task_id": "01920000-0000-7000-8000-0000000000d3"}') ->> 'duplicate', 'true',
  'a mesma chave de novo não roda a ação');
select is((select due_date from public.tasks where title = 'Conta'), '2026-11-15'::date,
  'reenvio não avança a data duas vezes');
select is((select count(*)::int from public.task_completions where task_id = '01920000-0000-7000-8000-0000000000d3'), 1,
  'uma conclusão só');

select throws_ok($$select * from public.applied_ops$$, '42501', null, 'cliente não lê as chaves');

-- Estranho: a ação falha (sem acesso) e a chave não fica gravada
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e3"}';
select throws_ok($$select public.run_once('01920000-0000-7000-8000-00000000c0e3', 'complete_task',
  '{"p_task_id": "01920000-0000-7000-8000-0000000000d3"}')$$, 'P0002', null, 'estranho não conclui');

select * from finish();
rollback;
