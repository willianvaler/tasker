-- Renascer (V4 §1.4, R1; D210). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

-- Bônus por renascimentos: os mesmos casos de lib/__tests__/gamification.test.ts
select is(public.rebirth_bonus(0), 0::numeric, 'sem renascer, sem bônus');
select is(public.rebirth_bonus(1), 0.05, '1 renascimento: +5%');
select is(public.rebirth_bonus(3), 0.15, '3 renascimentos: +15%');
select is(public.rebirth_bonus(9), 0.25, 'teto de +25%');

-- Ana no nível 21 (60.000 XP) com 300 de ouro, e um boss semanal derrotado no passado
insert into public.xp_events (user_id, kind, amount, day, gold, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'task', 60000, current_date, 300, clock_timestamp() - interval '2 days');
insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, level, starts_at, ends_at, status, created_at)
values ('user', '11111111-1111-1111-1111-111111111111', 'Antigo', '👹', '2000-W01', 10, 0, 1,
        now() - interval '30 days', now() - interval '23 days', 'defeated', now() - interval '30 days');
select public._refresh_profile_stats('11111111-1111-1111-1111-111111111111');
select is((select level from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 21, 'Ana no nível 21');

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.rebirth() $$, '22023', 'Renascer pede o nível 20', 'abaixo do nível 20 não renasce');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table r as select public.rebirth() as r;
select is(((select r from r) ->> 'rebirths')::integer, 1, 'renasceu uma vez');
select is((select level from public.profiles where id = auth.uid()), 1, 'volta ao nível 1');
select is((select xp from public.profiles where id = auth.uid()), 0, 'XP zerado');
select is((select coins from public.profiles where id = auth.uid()), 300, 'o ouro fica');
select ok(exists (select 1 from public.user_achievements where user_id = auth.uid() and achievement_key = 'rebirth_1'),
  'conquista "Renascido"');
select is((select count(*)::int from public.rebirth_log where user_id = auth.uid()), 1, 'fica no registro');
select is((public.game_state() ->> 'rebirths')::integer, 1, 'game_state mostra os renascimentos');

-- O XP novo vale 5% a mais
reset role;
-- (clock_timestamp: o now() da transação do teste é anterior ao renascimento)
insert into public.xp_events (user_id, kind, amount, day, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'task', 100, current_date, clock_timestamp());
select public._refresh_profile_stats('11111111-1111-1111-1111-111111111111');
select is((select xp from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 105,
  '100 de XP depois de renascer valem 105');

-- O boss semanal volta ao nível 1 (o derrotado de antes não conta)
delete from public.bosses where scope = 'user' and scope_id = '11111111-1111-1111-1111-111111111111' and status = 'active';
select is((public.ensure_weekly_boss('11111111-1111-1111-1111-111111111111')).level, 1, 'boss semanal recomeça no nível 1');

-- Ninguém grava o registro nem o contador direto
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ insert into public.rebirth_log (user_id, n, level, xp) values (auth.uid(), 9, 1, 0) $$,
  '42501', null, 'registro só pela função');
select throws_ok($$ update public.profiles set rebirths = 9 where id = auth.uid() $$,
  '42501', null, 'contador só pela função');

select * from finish();
rollback;
