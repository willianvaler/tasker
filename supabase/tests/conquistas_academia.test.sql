-- ESCOPO_V6 AC11 (D244): conquistas de academia pelo diário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
update public.profiles set timezone = 'UTC' where id = '11111111-1111-1111-1111-111111111111';

create function pg_temp.s(p_ex text, p_w numeric, p_r integer, p_at text, p_records text[] default '{}')
returns void language sql as $$
  insert into public.workout_sets (user_id, exercise_id, exercise_name, weight_kg, reps, performed_at, records)
  values ('11111111-1111-1111-1111-111111111111', p_ex, p_ex, p_w, p_r, p_at::timestamptz, p_records);
$$;
create function pg_temp.has(p_key text) returns boolean language sql as $$
  select exists (select 1 from public.user_achievements
                 where user_id = '11111111-1111-1111-1111-111111111111' and achievement_key = p_key);
$$;

-- Supino 60×10 (1RM 80) com recorde; corpo inteiro na mesma semana (alvos de cada grupo)
select pg_temp.s('mit-0025', 60, 10, '2026-10-19T12:00:00Z', '{weight}');
select pg_temp.s((select id from public.exercises where target = 'upper_back' order by id limit 1), 40, 10, '2026-10-19T12:10:00Z');
select pg_temp.s((select id from public.exercises where target = 'shoulders' order by id limit 1), 20, 10, '2026-10-20T12:00:00Z');
select pg_temp.s((select id from public.exercises where target = 'biceps' order by id limit 1), 10, 10, '2026-10-20T12:10:00Z');
select pg_temp.s((select id from public.exercises where target = 'quads' order by id limit 1), 80, 10, '2026-10-21T12:00:00Z');
select pg_temp.s((select id from public.exercises where target = 'abs' order by id limit 1), null, 20, '2026-10-21T12:10:00Z');

select ok((public._achievement_progress('11111111-1111-1111-1111-111111111111') ->> 'gym_days')::int = 3, '3 dias com série');
select public._check_achievements('11111111-1111-1111-1111-111111111111');
select ok(pg_temp.has('first_record'), 'primeiro recorde');
select ok(pg_temp.has('full_body_week'), 'corpo inteiro na semana');
select ok(not pg_temp.has('bench_bodyweight'), 'sem peso registrado, nada de supino do próprio peso');

-- Peso de 80 kg: o 1RM do supino (80) empata
insert into public.body_metrics (user_id, kind, value, measured_on)
values ('11111111-1111-1111-1111-111111111111', 'weight', 80, '2026-10-19');
select public._check_achievements('11111111-1111-1111-1111-111111111111');
select ok(pg_temp.has('bench_bodyweight'), 'supino do próprio peso');
select ok(not pg_temp.has('records_10'), 'a faixa de 10 recordes ainda não');

select * from finish();
rollback;
