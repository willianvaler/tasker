-- ESCOPO_V15 (CS1): equipamentos e planos de manutenção, a tarefa do plano e a próxima data depois
-- de concluir.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranha@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo' where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.equipments (id, name, room, brand) values
  ('e1000000-0000-0000-0000-000000000001', 'Ar-condicionado', 'Quarto', 'Positivo');
select is((select user_id from public.equipments), '11111111-1111-1111-1111-111111111111'::uuid, 'o equipamento é da dona');

-- Plano a cada 90 dias, feito pela última vez em 01/09
insert into public.maintenance_plans (id, equipment_id, name, every_n, unit, last_done_on) values
  ('a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Limpar o filtro', 90, 'dias', '2026-09-01');
select is((select next_on from public.maintenance_plans), '2026-11-30'::date, 'próxima = último feito + 90 dias');
select isnt((select task_id from public.maintenance_plans), null, 'o plano abriu a tarefa');
select is((select t.due_date from public.tasks t join public.maintenance_plans m on m.task_id = t.id), '2026-11-30'::date,
  'a tarefa vence na próxima data');
select is((select t.title from public.tasks t join public.maintenance_plans m on m.task_id = t.id), 'Limpar o filtro · Ar-condicionado',
  'o título junta o plano e o equipamento');
select ok((select p.is_inbox from public.tasks t join public.maintenance_plans m on m.task_id = t.id join public.pages p on p.id = t.page_id),
  'sem lista escolhida, vai para a Caixa de entrada');

-- Concluir: o último feito é o dia da conclusão e a seguinte nasce 90 dias depois
create temp table primeira as select task_id as id from public.maintenance_plans;
grant select on primeira to authenticated;
reset role;
create temp table hoje as select public.user_today('11111111-1111-1111-1111-111111111111') as d;
grant select on hoje to authenticated;
set local role authenticated;
select public.complete_task((select id from primeira));
select is((select last_done_on from public.maintenance_plans), (select d from hoje),
  'concluir grava o último feito');
select is((select next_on from public.maintenance_plans), (select d from hoje) + 90,
  'a próxima conta a partir de quando concluiu');
select isnt((select task_id from public.maintenance_plans), (select id from primeira), 'a seguinte é outra tarefa');
select is((select count(*)::int from public.tasks t where t.meta #>> '{manutencao,plano}' = 'a1000000-0000-0000-0000-000000000001'
            and t.status = 'todo'), 1, 'uma tarefa aberta por plano');

-- Desfazer: volta o último feito e a seguinte (intocada) sai
select public.uncomplete_task((select id from primeira));
select is((select last_done_on from public.maintenance_plans), '2026-09-01'::date, 'desfazer volta o último feito');
select is((select task_id from public.maintenance_plans), (select id from primeira), 'e o plano aponta de novo para a primeira');
select is((select count(*)::int from public.tasks t where t.meta #>> '{manutencao,plano}' = 'a1000000-0000-0000-0000-000000000001'),
  1, 'a seguinte foi apagada');

-- Parar o plano tira a tarefa aberta
update public.maintenance_plans set paused = true;
select is((select count(*)::int from public.tasks t where t.meta #>> '{manutencao,plano}' = 'a1000000-0000-0000-0000-000000000001'
            and t.status = 'todo'), 0, 'plano parado não tem tarefa aberta');

-- O cliente não escreve as colunas do servidor
select throws_ok($$ update public.maintenance_plans set next_on = '2030-01-01' $$, '42501', null,
  'a próxima data é só do servidor');

-- Estranha não vê nem grava
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.equipments) + (select count(*)::int from public.maintenance_plans), 0,
  'estranha não vê equipamentos nem planos');
select throws_ok($$ insert into public.maintenance_plans (equipment_id, name) values ('e1000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'estranha não cria plano no equipamento dos outros');

-- A conta da próxima data (mesmos casos de lib/__tests__/maintenance.test.ts)
select is(public.maintenance_next(null, 3, 'meses', '2026-11-25'), '2026-11-25'::date, 'sem último feito, é hoje');
select is(public.maintenance_next('2026-01-31', 1, 'meses', '2026-01-31'), '2026-02-28'::date, '31/01 + 1 mês = 28/02');
select is(public.maintenance_next('2024-02-29', 12, 'meses', '2024-02-29'), '2025-02-28'::date, '29/02 + 12 meses = 28/02');

-- A exportação leva os dois
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(jsonb_array_length(public.export_my_data() -> 'maintenance_plans'), 1, 'a exportação leva os planos');

select * from finish();
rollback;
