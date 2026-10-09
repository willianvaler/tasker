-- Fase 2: ciclos, hábitos, recorrência, histórico e duplicar página. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------- Funções puras ----------
select is(public.cycle_key_for('daily', 'America/Sao_Paulo', '2026-10-09 01:00+00', 0), '2026-10-08',
  'dia no fuso do dono (01:00 UTC ainda é dia 8 em SP)');
select is(public.cycle_key_for('weekly', 'America/Sao_Paulo', '2026-10-12 12:00+00', 0), '2026-W42', 'semana ISO começa na segunda');
select is(public.cycle_key_for('weekly', 'America/Sao_Paulo', '2026-10-11 12:00+00', 0), '2026-W41', 'domingo ainda é a semana anterior');
select is(public.cycle_key_for('monthly', 'UTC', '2026-10-31 23:00+00', 0), '2026-10', 'mês');
select is(public.cycle_key_for('manual', 'UTC', now(), 3), 'm3', 'manual usa o contador');
select is(public.task_cycle_kind('habits', 'none', null), 'daily', 'hábito sem recorrência é diário');
select is(public.task_cycle_kind('habits', 'none', '{"type": "weekdays", "days": [1]}'), 'daily', 'hábito por dias da semana: ciclo diário');
select is(public.task_cycle_kind('cards', 'weekly', null), 'weekly', 'cards com reset semanal');
select is(public.task_cycle_kind('list', 'none', '{"type": "daily"}'), 'once', 'lista comum nunca reseta');

-- Quinta, 08/10/2026
select is(public.next_due_date('{"type": "daily"}', '2026-10-08', '2026-10-08'), '2026-10-09'::date, 'diária: amanhã');
select is(public.next_due_date('{"type": "daily"}', '2026-10-01', '2026-10-08'), '2026-10-09'::date, 'diária atrasada não empilha no passado');
select is(public.next_due_date('{"type": "weekly"}', '2026-10-08', '2026-10-08'), '2026-10-15'::date, 'semanal');
select is(public.next_due_date('{"type": "weekly"}', '2026-09-24', '2026-10-08'), '2026-10-15'::date, 'semanal atrasada mantém o dia da semana');
select is(public.next_due_date('{"type": "monthly"}', '2026-01-31', '2026-01-31'), '2026-02-28'::date, 'mensal no fim do mês');
select is(public.next_due_date('{"type": "monthly"}', '2026-01-31', '2026-03-01'), '2026-03-31'::date, 'mensal não escorrega');
select is(public.next_due_date('{"type": "weekdays", "days": [1, 3, 5]}', null, '2026-10-08'), '2026-10-09'::date, 'seg/qua/sex a partir de quinta: sexta');
select is(public.next_due_date('{"type": "weekdays", "days": [1, 3, 5]}', '2026-10-09', '2026-10-09'), '2026-10-12'::date, 'depois da sexta: segunda');

-- ---------- Com usuário ----------
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Academia');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hábitos', 'habits', 'none'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contas', 'list', 'none'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rotina', 'cards', 'manual');

select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "cccccccc-0000-0000-0000-000000000001", "title": "Supino", "meta": {"sets": 4, "reps": 12, "weight": "20kg"}},
    {"id": "cccccccc-0000-0000-0000-000000000002", "title": "Remada"}]');
select is((select meta ->> 'weight' from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), '20kg', 'lote grava meta');

select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select matches((select done_cycle_key from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), '^\d{4}-W\d{2}$',
  'card com reset semanal guarda a semana');
select is((select count(*)::int from public.task_completions where task_id = 'cccccccc-0000-0000-0000-000000000001'), 1,
  'conclusão vai para o histórico');
select is(public.refresh_cycles('bbbbbbbb-0000-0000-0000-000000000001'), 0, 'mesma semana: nada reabre');

-- Simula a virada da semana: a marcação ficou numa semana passada
reset role;
update public.tasks set done_cycle_key = '2026-W01' where id = 'cccccccc-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.refresh_cycles(), 1, 'semana nova: reabre');
select is((select status::text from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), 'todo', 'card voltou a ficar aberto');
select is((select count(*)::int from public.task_completions where task_id = 'cccccccc-0000-0000-0000-000000000001'), 1,
  'o histórico fica');

-- Desmarcar apaga a conclusão do ciclo
select public.complete_task('cccccccc-0000-0000-0000-000000000002');
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000002');
select is((select count(*)::int from public.task_completions where task_id = 'cccccccc-0000-0000-0000-000000000002'), 0,
  'desmarcar tira do histórico');

-- Recorrente comum: avança a data e desfaz
insert into public.tasks (id, page_id, title, due_date, recurrence)
values ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'Luz', '2000-01-10', '{"type": "monthly"}');
select is(public.complete_task('cccccccc-0000-0000-0000-000000000003') #>> '{task,status}', 'todo', 'recorrente continua aberta');
select ok((select due_date > current_date from public.tasks where id = 'cccccccc-0000-0000-0000-000000000003'),
  'recorrente vai para a próxima data, depois de hoje');
select is((public.uncomplete_task('cccccccc-0000-0000-0000-000000000003') #>> '{task,due_date}')::date, '2000-01-10'::date,
  'desfazer volta a data anterior');

-- Reset manual
insert into public.tasks (id, page_id, title) values ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 'Alongar');
select public.complete_task('cccccccc-0000-0000-0000-000000000004');
select is(public.reset_page('bbbbbbbb-0000-0000-0000-000000000004'), 1, 'reset manual reabre');
select throws_ok($$ select public.reset_page('bbbbbbbb-0000-0000-0000-000000000001') $$, '22023', null,
  'reset manual só em página manual');

-- Duplicar
insert into public.tasks (page_id, parent_task_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Aquecer');
select public.complete_task('cccccccc-0000-0000-0000-000000000002');
-- (em comando separado: no where rodaria uma vez por linha, e numa CTE o select não veria as cópias)
create temp table dup on commit drop as
  select public.duplicate_page('bbbbbbbb-0000-0000-0000-000000000001', 'Treino B') as id;
select is((select count(*)::int from public.tasks where page_id = (select id from dup)), 3,
  'duplicar copia tarefas e subtarefas');
select is((select count(*)::int from public.tasks t join public.pages p on p.id = t.page_id
           where p.name = 'Treino B' and (t.status = 'done' or (t.parent_task_id is not null and t.parent_task_id not in (select id from public.tasks where page_id = p.id)))), 0,
  'cópia vem toda aberta e com subtarefas ligadas às mães copiadas');

select * from finish();
rollback;
