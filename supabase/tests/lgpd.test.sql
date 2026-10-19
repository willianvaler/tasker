-- LGPD (V5 §4; D213): aceite dos termos no cadastro e por atualização, pedidos do titular.
-- Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Cadastro pelo formulário (com o aceite nos metadados) e uma conta antiga (sem)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"display_name": "Ana", "accepted_terms": "2026-10-19"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{"display_name": "Bia"}');

select is((select version from public.consents where user_id = '11111111-1111-1111-1111-111111111111'),
  public.legal_version(), 'o cadastro grava o aceite da versão vigente');
select is((select source from public.consents where user_id = '11111111-1111-1111-1111-111111111111'),
  'signup', 'vindo do cadastro');
select is((select count(*)::int from public.consents where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'conta antiga: sem aceite');

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.consent_status() ->> 'accepted', null, 'consent_status: ainda não aceitou');
select throws_ok($$ select public.accept_terms('2000-01-01') $$, '22023', null, 'versão velha não vale');
select lives_ok($$ select public.accept_terms(public.legal_version()) $$, 'aceita a versão vigente');
select is(public.consent_status() ->> 'accepted', public.legal_version(), 'consent_status: aceitou');
select is((select count(*)::int from public.consents), 1, 'só vê o próprio aceite');
select throws_ok($$ insert into public.consents (user_id, version, source) values (auth.uid(), 'x', 'update') $$,
  '42501', null, 'aceite só pela função');

-- Pedidos do titular
select lives_ok($$ select public.request_data_action('correction', 'Meu nome está errado') $$, 'faz um pedido');
select throws_ok($$ select public.request_data_action('correction', 'de novo') $$, '22023', null,
  'um pedido aberto por tipo');
select ok((select due_at > now() + interval '14 days' from public.data_requests where kind = 'correction'),
  'prazo de 15 dias');
select ok((public.export_my_data() -> 'consents') is not null and jsonb_array_length(public.export_my_data() -> 'data_requests') = 1,
  'exportar leva o aceite e os pedidos');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.data_requests), 0, 'estranho não vê o pedido');

select * from finish();
rollback;
