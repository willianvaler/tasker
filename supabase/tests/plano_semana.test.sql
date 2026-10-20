-- ESCOPO_V6 AC9.5 (D243): plano da semana (_planned_on, os mesmos casos de
-- lib/gym/__tests__/week-plan.test.ts), remarcação só da pessoa e o lembrete do dia de treino.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Treinos');
insert into public.pages (id, folder_id, name, view_type, train_days) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', '{1,3,5}');
insert into public.workout_moves (page_id, from_day, to_day) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '2026-10-19', '2026-10-20'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '2026-10-21', null);
reset role;

-- 2026-10-19 é segunda
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-23'), true, 'pelo plano (sexta)');
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-22'), false, 'fora do plano (quinta)');
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-19'), false, 'remarcado sai do dia');
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-20'), true, 'e entra no outro');
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-21'), false, 'pulado sai');
select is(public._planned_on('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '2026-10-19'), true,
  'a remarcação é de cada pessoa');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.workout_moves), 0, 'estranho não vê as remarcações');
select throws_ok($$ insert into public.workout_moves (page_id, from_day) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '2026-10-23') $$, '42501', null, 'nem remarca treino dos outros');
reset role;

-- Lembrete: treino todo dia, ainda sem série, depois das 18 h no fuso da pessoa (o fuso do teste
-- é escolhido para a hora local passar das 18 agora)
update public.pages set train_days = '{0,1,2,3,4,5,6}' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.workout_moves;
do $$
declare
  k integer := 20 - extract(hour from now() at time zone 'UTC')::integer;
begin
  if k > 14 then k := k - 24; end if;
  if k < -12 then k := k + 24; end if;
  update public.profiles set gym_enabled = true,
    timezone = case when k >= 0 then 'Etc/GMT-' || k else 'Etc/GMT+' || (-k) end
  where id = '11111111-1111-1111-1111-111111111111';
end $$;
select is(public.send_workout_reminders(), 1, 'dia de treino sem série: um aviso');
select is(public.send_workout_reminders(), 0, 'um só por dia');
select is((select payload ->> 'page_name' from public.notifications
           where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'workout_reminder'), 'Treino A',
  'com o treino do dia');

select * from finish();
rollback;
