-- Força do hábito e hábito de um lado só (HB2, D194). Os casos de _habit_step e habit_value_now são
-- os mesmos de src/lib/__tests__/habit-value.test.ts. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(public._habit_step(0, 1), 1.0000, '+ de 0 dá 1');
select is(public._habit_step(1, 1), 1.9747, '+ de 1 dá 1,9747');
select is(public._habit_step(-10, 1), -8.7079, '+ de −10 rende mais');
select is(public._habit_step(0, -1), -1.0267, '− de 0');
select is(public._habit_step(1.9747, -1), 1.0000, '− desfaz o +');
select is(public._habit_step(21, 1), 21.27, 'teto');
select is(public._habit_step(-47.27, -1), -47.27, 'piso');
select is(public.habit_value_now(8, 'up', '2026-10-17', '2026-10-19'), 2.0000, 'só bom: metade por dia');
select is(public.habit_value_now(-8, 'down', '2026-10-18', '2026-10-19'), -4.0000, 'só ruim: metade por dia');
select is(public.habit_value_now(0.15, 'up', '2026-10-18', '2026-10-19'), 0::numeric, 'abaixo de 0,1 zera');
select is(public.habit_value_now(8, 'both', '2026-10-01', '2026-10-19'), 8::numeric, 'dois lados não decai');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
create temp table ids as
select p.id from public.pages p join public.folders f on f.id = p.folder_id
where f.owner_id = '11111111-1111-1111-1111-111111111111' and p.is_habits;
grant select on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_tasks_batch((select id from ids), '[{"title": "Fumar", "habit_kind": "plusminus"}]');

select throws_ok($$ update public.tasks set habit_value = 5 where title = 'Fumar' $$, '42501', null,
  'o valor é do servidor');
update public.tasks set habit_sides = 'down' where title = 'Fumar';
select is((select habit_sides from public.tasks where title = 'Fumar'), 'down', 'a pessoa escolhe os lados');
select throws_ok($$ select public.habit_tick((select id from public.tasks where title = 'Fumar'), 1) $$,
  '22023', null, 'só ruim: sem +');

create temp table ev as select (public.habit_tick((select id from public.tasks where title = 'Fumar'), -1)
  ->> 'event_id')::uuid as id;
select is((select habit_value from public.tasks where title = 'Fumar'), -1.0267, 'o − baixa a força');
select public.undo_habit_tick((select id from ev));
select is((select habit_value from public.tasks where title = 'Fumar'), 0.0000, 'desfazer volta ao valor');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.tasks set habit_sides = 'up' where title = 'Fumar';
select is((select count(*)::int from public.tasks where title = 'Fumar'), 0, 'estranho não vê');
reset role;
select is((select habit_sides from public.tasks where title = 'Fumar'), 'down', 'nem muda os lados');

select * from finish();
rollback;
