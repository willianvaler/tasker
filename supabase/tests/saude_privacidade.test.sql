-- SA0 (D382): consentimento da saúde e campos sensíveis liberados campo a campo
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(public.has_sensitive_consent('health'), false, 'sem consentimento da saúde no começo');
select lives_ok($$select public.grant_sensitive_consent('health')$$, 'dá o consentimento da saúde');
select is(public.has_sensitive_consent('health'), true, 'consentimento ativo');

select is(public.release_sensitive_field('Health.Agua.ML'), 'saude.agua.ml', 'apelido vira o nome canônico');
select throws_ok($$select public.release_sensitive_field('usuario.nivel')$$, '22023', null,
  'só campos sensíveis');
select throws_ok($$select public.release_sensitive_field('saude')$$, '22023', null,
  'precisa do campo, não do espaço inteiro');
select throws_ok($$insert into public.sensitive_releases (field) values ('saude.sono')$$, '42501', null,
  'ninguém grava direto');
select is((select array_agg(field) from public.sensitive_releases), array['saude.agua.ml'], 'a dona vê o dela');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.sensitive_releases), 0, 'outra pessoa não vê');

reset role;
select is(public._sensitive_released('11111111-1111-1111-1111-111111111111'), '["saude.agua.ml"]'::jsonb,
  'o executor recebe a lista');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.unrelease_sensitive_field('saude.agua.ml');
select is((select count(*)::int from public.sensitive_releases), 0, 'tirar a liberação apaga');

select * from finish();
rollback;
