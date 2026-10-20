-- ESCOPO_V6 AC5 (D237): recordes do diário (_set_records, os mesmos casos de
-- lib/gym/__tests__/records.test.ts), 1RM (_e1rm) e o crítico garantido.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
update public.profiles set timezone = 'UTC' where id = '11111111-1111-1111-1111-111111111111';

-- Uma série no diário (como superusuário): exercício, carga, reps, dia, extra
create function pg_temp.s(p_ex text, p_w numeric, p_r integer, p_day text, p_warm boolean default false,
                          p_dur integer default null, p_dist numeric default null)
returns uuid language sql as $$
  insert into public.workout_sets (user_id, exercise_id, exercise_name, weight_kg, reps, warmup,
                                   duration_seconds, distance_m, performed_at)
  values ('11111111-1111-1111-1111-111111111111', p_ex, p_ex, p_w, p_r, p_warm, p_dur, p_dist,
          (p_day || 'T12:00:00Z')::timestamptz)
  returning id;
$$;
create function pg_temp.r(p_id uuid) returns text[] language sql as $$
  select public._set_records(w) from public.workout_sets w where w.id = p_id;
$$;
-- O "base" dos testes do app: 40×10 duas vezes no dia 1
create function pg_temp.base(p_ex text) returns void language sql as $$
  select pg_temp.s(p_ex, 40, 10, '2026-10-01'); select pg_temp.s(p_ex, 40, 10, '2026-10-01');
$$;

select is(public._e1rm(40, 10), 53.33, 'Epley 40×10');
select is(public._e1rm(100, 1), 100.00, 'uma repetição é a carga');
select is(public._e1rm(50, 13), null, 'acima de 12 não estima');

select pg_temp.base('a');
select is(pg_temp.r(pg_temp.s('a', 42.5, 8, '2026-10-02')), array['weight', 'one_rm'], 'mais carga e maior 1RM');
select pg_temp.base('b');
select is(pg_temp.r(pg_temp.s('b', 40, 11, '2026-10-02')), array['reps', 'one_rm'], 'mais repetições na mesma carga');
select pg_temp.base('c');
select is(pg_temp.r(pg_temp.s('c', 40, 10, '2026-10-02')), '{}'::text[], 'igual não é recorde');
select pg_temp.base('d');
select is(pg_temp.r(pg_temp.s('d', 100, 1, '2026-10-02', true)), '{}'::text[], 'aquecimento não é recorde');
select is(pg_temp.r(pg_temp.s('e', 40, 10, '2026-10-01')), '{}'::text[], 'a primeira série não é recorde');
select pg_temp.s('f', 200, 1, '2026-10-01', true);
select is(pg_temp.r(pg_temp.s('f', 40, 10, '2026-10-02')), '{}'::text[], 'aquecimento não conta como anterior');

select pg_temp.base('g');
select pg_temp.s('g', 40, 10, '2026-10-02');
select is(pg_temp.r(pg_temp.s('g', 40, 11, '2026-10-02')), array['reps', 'one_rm', 'volume'],
  'volume do dia passa do melhor dia anterior');
select is(pg_temp.r(pg_temp.s('g', 40, 5, '2026-10-02')), '{}'::text[], 'e só na série que passa');

select pg_temp.s('h', null, 15, '2026-10-01');
select is(pg_temp.r(pg_temp.s('h', null, 16, '2026-10-02')), array['reps'], 'peso do corpo: mais repetições');
select pg_temp.base('i');
select is(pg_temp.r(pg_temp.s('i', 50, 13, '2026-10-02')), array['weight'], 'acima de 12 repetições não conta 1RM');
select pg_temp.s('j', null, null, '2026-10-01', false, 45);
select is(pg_temp.r(pg_temp.s('j', null, null, '2026-10-02', false, 60)), array['duration'], 'mais tempo');

-- Recorde no exercício: a conclusão sai crítica, sempre
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Treinos');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino", "exercise_id": "pg-crit",
     "repeat_plan": {"mode": "sets", "total": 1}}]');
reset role;
select pg_temp.s('pg-crit', 40, 10, '2026-10-01');
set local role authenticated;
select public.log_rep('c0000000-0000-0000-0000-000000000001', 1, '{"weight": "45kg", "reps": 10}');
reset role;
select ok((select bool_or(crit) from public.xp_events where task_id = 'c0000000-0000-0000-0000-000000000001'
           and damage > 0 and not reverted),
  'recorde no exercício: golpe crítico garantido');

select * from finish();
rollback;
