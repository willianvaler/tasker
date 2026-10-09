-- Fase 1: lote, conclusão por RPC, etiquetas e fuso. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table inbox on commit drop as select id from public.pages where is_inbox;
grant select on inbox to authenticated;

select is((select count(*)::int from public.create_tasks_batch((select id from inbox), $$[
  {"title": "Comprar carne", "priority": 2, "labels": ["#Churrasco", "mercado", "churrasco"]},
  {"id": "cccccccc-0000-0000-0000-000000000002", "title": "Treino", "children": [{"title": "Supino"}, {"title": "Remada", "done": true}]},
  {"title": "Pagar conta", "due_date": "2026-10-15", "recurrence": {"type": "monthly"}}
]$$::jsonb)), 5, 'lote cria 3 tarefas + 2 subtarefas');

select is(
  (select array_agg(title order by position) from public.tasks where page_id = (select id from inbox) and parent_task_id is null),
  array['Comprar carne', 'Treino', 'Pagar conta'], 'lote preserva a ordem');
select is((select labels from public.tasks where title = 'Comprar carne'), array['churrasco', 'mercado'],
  'etiquetas normalizadas (sem #, minúsculas, sem repetidas)');
select is((select count(*)::int from public.tasks where parent_task_id = 'cccccccc-0000-0000-0000-000000000002'), 2,
  'subtarefas ficam na tarefa mãe');
select is((select status::text from public.tasks where title = 'Remada'), 'done', 'item [x] do lote já vem concluído');
select is((select completed_by from public.tasks where title = 'Remada'), '11111111-1111-1111-1111-111111111111'::uuid,
  'concluído pelo usuário do lote');
select is((select due_date from public.tasks where title = 'Pagar conta'), '2026-10-15'::date, 'data de vencimento');

select lives_ok($$ select public.create_tasks_batch((select id from inbox), '[{"title": "Mais uma"}]') $$, 'lote com 1 item');
select is((select position from public.tasks where title = 'Mais uma'), 4::double precision, 'novo lote vai para o fim');

select is(public.complete_task((select id from public.tasks where title = 'Comprar carne')) #>> '{task,status}', 'done',
  'complete_task conclui');
select isnt((select completed_at from public.tasks where title = 'Comprar carne'), null, 'complete_task grava completed_at');
select is(public.uncomplete_task((select id from public.tasks where title = 'Comprar carne')) #>> '{task,completed_at}', null,
  'uncomplete_task desfaz');

select throws_ok($$ select public.create_tasks_batch((select id from inbox), (select jsonb_agg(jsonb_build_object('title', 't' || g)) from generate_series(1, 501) g)) $$,
  '22023', null, 'limite de 500 por lote');
select throws_ok($$ update public.profiles set timezone = 'Lua/Base' where id = '11111111-1111-1111-1111-111111111111' $$,
  '22023', null, 'fuso horário inválido é recusado');

-- Bia não conclui nem cria na página da Ana
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.complete_task('cccccccc-0000-0000-0000-000000000002') $$,
  'P0002', null, 'estranho não conclui tarefa');
select throws_ok($$ select public.create_tasks_batch((select id from inbox), '[{"title": "invasão"}]') $$,
  'P0002', null, 'estranho não cria em lote na página dos outros');

select * from finish();
rollback;
