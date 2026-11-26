-- SA2 (D383): água. Sem o consentimento da saúde nada grava; só a dona vê; revogar apaga; exporta
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok($$insert into public.water_logs (ml, day) values (250, current_date)$$, '42501', null,
  'sem consentimento, a água não grava');
select throws_ok($$insert into public.health_settings (water_goal_ml) values (2500)$$, '42501', null,
  'nem a meta');

select public.grant_sensitive_consent('health');
select lives_ok($$insert into public.water_logs (ml, day) values (250, current_date), (500, current_date)$$,
  'com consentimento, grava');
select lives_ok($$insert into public.health_settings (water_goal_ml, cup_ml) values (2500, 300)$$, 'a meta também');
select throws_ok($$insert into public.water_logs (ml, day) values (0, current_date)$$, '23514', null,
  'quantidade precisa ser positiva');
select is((public.export_my_data() -> 'water_logs' -> 0 ->> 'ml')::int, 250, 'a água entra na exportação');
select is((public.export_my_data() -> 'health_settings' ->> 'water_goal_ml')::int, 2500, 'a meta também');

-- Outra pessoa (amiga, do time, qualquer uma) não vê
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.water_logs) + (select count(*)::int from public.health_settings), 0,
  'outra pessoa não vê nada');

-- Revogar apaga
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.revoke_sensitive_consent('health');
select is((select count(*)::int from public.water_logs), 0, 'revogar apaga a água');
select is((select count(*)::int from public.health_settings), 0, 'e a meta');

select * from finish();
rollback;
