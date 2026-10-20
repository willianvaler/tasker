-- ESCOPO_V6 AC4 (D236): diário de treino (workout_sets), gravado por log_rep, log_warmup e
-- log_group_set; cada pessoa vê só o seu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Treinos', 'project');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino reto", "exercise_id": "mit-0025",
     "repeat_plan": {"mode": "sets", "total": 2}},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Prancha",
     "repeat_plan": {"mode": "timed", "total": 2, "duration_seconds": 45}}]');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;

-- Os mesmos casos de textToKg (lib/gym/__tests__/units-effort.test.ts)
select is(public._set_weight_kg('40kg'), 40.00, '40kg');
select is(public._set_weight_kg('20,5 kg'), 20.50, '20,5 kg');
select is(public._set_weight_kg('100lb'), 45.36, '100 lb em kg');
select is(public._set_weight_kg('40'), null, 'sem unidade não é carga');

select public.log_rep('c0000000-0000-0000-0000-000000000001', 1,
  '{"set_id": "d0000000-0000-0000-0000-000000000001", "weight": "40kg", "reps": 10, "effort": 8.5, "effort_scale": "rpe"}');
select results_eq($$ select weight_kg, reps, effort, effort_scale, exercise_id, exercise_name, set_index, warmup
                     from public.workout_sets where id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values (40.00::numeric(7,2), 10, 8.5::numeric(3,1), 'rpe', 'mit-0025', 'Supino reto', 1, false) $$,
  'a série vai para o diário com o id do aparelho');

select public.log_warmup('c0000000-0000-0000-0000-000000000001', '{"weight": "20kg", "reps": 12}');
select is((select done_reps from public.task_progress where task_id = 'c0000000-0000-0000-0000-000000000001'), 1,
  'aquecimento não conta série');
select is((select count(*)::int from public.workout_sets where warmup), 1, 'mas fica no diário, marcado');

select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "42,5kg", "reps": 8, "effort": 8.25, "effort_scale": "rpe"}');
select results_eq($$ select weight_kg, effort from public.workout_sets where set_index = 2 $$,
  $$ values (42.50::numeric(7,2), null::numeric(3,1)) $$, 'esforço fora da escala fica de fora; a série conta');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'done',
  'a última série conclui como antes');

select public.log_rep('c0000000-0000-0000-0000-000000000001', -1);
select is((select count(*)::int from public.workout_sets where not warmup), 1, 'desfazer tira a última que conta');
select is((select count(*)::int from public.workout_sets where warmup), 1, 'o aquecimento fica');

select public.log_rep('c0000000-0000-0000-0000-000000000002', 1, null);
select results_eq($$ select kind, duration_seconds from public.workout_sets where task_id = 'c0000000-0000-0000-0000-000000000002' $$,
  $$ values ('time', 45) $$, 'item por tempo grava o tempo do plano');

select lives_ok($$ select public.run_once('e0000000-0000-0000-0000-000000000001', 'delete_workout_set',
  '{"p_id": "d0000000-0000-0000-0000-000000000001"}') $$, 'apagar pela fila do aparelho');
select is((select count(*)::int from public.workout_sets where id = 'd0000000-0000-0000-0000-000000000001'), 0, 'apagou');
select throws_ok($$ insert into public.workout_sets (exercise_name) values ('falso') $$, '42501', null,
  'o diário não aceita escrita direta');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.workout_sets), 0, 'a colega do projeto não vê o diário da Ana');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.log_warmup('c0000000-0000-0000-0000-000000000001', '{}') $$, 'P0002', null,
  'estranho não grava aquecimento na tarefa dos outros');

select * from finish();
rollback;
