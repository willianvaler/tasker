-- BE4 (D270): remédios, dado de saúde (LGPD art. 11): só com o consentimento específico, só a
-- pessoa vê e muda, revogar apaga, entra na exportação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok($$ insert into public.medications (name, stock, stock_on) values ('Losartana', 30, '2026-10-01') $$,
  '42501', null, 'sem consentimento não grava');

select public.grant_sensitive_consent('medications');
select is(public.has_sensitive_consent('medications'), true, 'consentimento dos remédios');
select is(public.has_sensitive_consent('body_metrics'), false, 'separado do peso');
select lives_ok($$ insert into public.medications (id, name, dose, times_per_day, pack_size, stock, stock_on)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Losartana', 1, 2, 30, 30, '2026-10-01') $$,
  'com consentimento grava');
select throws_ok($$ insert into public.medications (name, times_per_day, stock, stock_on) values ('X', 0, 1, '2026-10-01') $$,
  '23514', null, 'vezes por dia de 1 a 24');
select throws_ok($$ insert into public.medications (user_id, name, stock, stock_on)
  values ('33333333-3333-3333-3333-333333333333', 'X', 1, '2026-10-01') $$, '42501', null,
  'não grava em nome de outra pessoa');
select ok(jsonb_array_length(public.export_my_data() -> 'medications') = 1, 'entra na exportação');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.medications), 0, 'ninguém mais vê');
update public.medications set stock = 0;
delete from public.medications;

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select stock::int from public.medications), 30, 'estranho não muda nem apaga');

select public.revoke_sensitive_consent('medications');
select is((select count(*)::int from public.medications), 0, 'revogar apaga o que havia');
select throws_ok($$ insert into public.medications (name, stock, stock_on) values ('Losartana', 30, '2026-10-02') $$,
  '42501', null, 'revogado, não grava mais');

select * from finish();
rollback;
