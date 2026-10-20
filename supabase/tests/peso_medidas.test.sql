-- ESCOPO_V6 AC7 (D239): peso e medidas, dado sensível (LGPD art. 11): só com o consentimento
-- específico, só a pessoa vê, revogar apaga, entra na exportação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok($$ insert into public.body_metrics (kind, value, measured_on) values ('weight', 80, '2026-10-01') $$,
  '42501', null, 'sem consentimento não grava');
select is(public.has_sensitive_consent('body_metrics'), false, 'começa sem consentimento');

select public.grant_sensitive_consent('body_metrics');
select public.grant_sensitive_consent('body_metrics');
select is((select count(*)::int from public.sensitive_consents), 1, 'dar duas vezes fica um registro');
select lives_ok($$ insert into public.body_metrics (kind, value, measured_on) values ('weight', 80, '2026-10-01'),
  ('waist', 85, '2026-10-01') $$, 'com consentimento grava');
select lives_ok($$ insert into public.body_goals (kind, target) values ('weight', 75) $$, 'e a meta');
select throws_ok($$ insert into public.body_metrics (user_id, kind, value, measured_on)
  values ('33333333-3333-3333-3333-333333333333', 'weight', 80, '2026-10-01') $$, '42501', null,
  'não grava em nome de outra pessoa');
select ok(jsonb_array_length(public.export_my_data() -> 'body_metrics') = 2, 'entra na exportação');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.body_metrics) + (select count(*)::int from public.body_goals), 0,
  'ninguém mais vê');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.revoke_sensitive_consent('body_metrics');
select is((select count(*)::int from public.body_metrics) + (select count(*)::int from public.body_goals), 0,
  'revogar apaga o que havia');
select ok((select revoked_at is not null from public.sensitive_consents), 'o registro fica, com a data');
select throws_ok($$ insert into public.body_metrics (kind, value, measured_on) values ('weight', 80, '2026-10-02') $$,
  '42501', null, 'revogado, não grava mais');

select * from finish();
rollback;
