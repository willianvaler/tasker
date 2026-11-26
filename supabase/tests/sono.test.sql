-- SA1 (D384): sono. Sem o consentimento nada grava; só a dona vê; revogar apaga; exporta
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$insert into public.sleep_logs (day, bed_time, wake_time) values (current_date, '23:30', '07:00')$$,
  '42501', null, 'sem consentimento, o sono não grava');
select public.grant_sensitive_consent('health');
select lives_ok($$insert into public.sleep_logs (day, bed_time, wake_time) values (current_date, '23:30', '07:00')$$,
  'com consentimento, grava');
select throws_ok($$insert into public.sleep_logs (day, bed_time, wake_time) values (current_date, '07:00', '07:00')$$,
  '23514', null, 'dormir e acordar na mesma hora não vale');
select is(public.export_my_data() -> 'sleep_logs' -> 0 ->> 'wake_time', '07:00:00', 'o sono entra na exportação');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.sleep_logs), 0, 'outra pessoa não vê');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$insert into public.health_settings (sleep_goal_min) values (420)$$, 'meta de sono');
select public.revoke_sensitive_consent('health');
select is((select count(*)::int from public.sleep_logs), 0, 'revogar apaga o sono');

select * from finish();
rollback;
