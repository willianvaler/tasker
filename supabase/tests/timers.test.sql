-- V3 §4.2 (J2): timers com fim absoluto, um ativo por pessoa, só por RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((public.start_timer('a0000000-0000-0000-0000-000000000001', 'rest', '2026-10-14 10:00:00+00', 90)).ends_at,
  '2026-10-14 10:01:30+00'::timestamptz, 'o fim é absoluto: início + duração');
select is((public.start_timer('a0000000-0000-0000-0000-000000000001', 'rest', '2026-10-14 10:00:00+00', 90)).state,
  'running', 'repetir o mesmo id não cria outro');
select is((select count(*)::int from public.timers), 1, 'continua um só');

select is((public.update_timer('a0000000-0000-0000-0000-000000000001', 'adjust', 30, '2026-10-14 10:00:10+00')).ends_at,
  '2026-10-14 10:02:00+00'::timestamptz, '+30 s empurra o fim');
select is((public.update_timer('a0000000-0000-0000-0000-000000000001', 'adjust', -600, '2026-10-14 10:00:20+00')).ends_at,
  '2026-10-14 10:00:20+00'::timestamptz, '−30 s nunca volta antes de agora');

-- Pausa guarda o que falta; retomar recalcula o fim
select lives_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000001', 'adjust', 60, '2026-10-14 10:00:20+00') $$, 'mais um minuto');
select is((public.update_timer('a0000000-0000-0000-0000-000000000001', 'pause', 0, '2026-10-14 10:00:50+00')).paused_seconds,
  30, 'pausado faltando 30 s');
select is((public.update_timer('a0000000-0000-0000-0000-000000000001', 'resume', 0, '2026-10-14 10:05:00+00')).ends_at,
  '2026-10-14 10:05:30+00'::timestamptz, 'retomar: agora + o que faltava');

-- Iniciar outro cancela o ativo; um comando atrasado (começou antes) já nasce cancelado
select lives_ok($$ select public.start_timer('a0000000-0000-0000-0000-000000000002', 'countdown', '2026-10-14 10:06:00+00', 300) $$,
  'outro timer');
select is((select state from public.timers where id = 'a0000000-0000-0000-0000-000000000001'), 'cancelled',
  'o anterior foi cancelado');
select is((public.start_timer('a0000000-0000-0000-0000-000000000003', 'rest', '2026-10-14 10:03:00+00', 60)).state,
  'cancelled', 'o que começou antes do ativo (offline, atrasado) não toma o lugar');
select is((select count(*)::int from public.timers where state in ('running', 'paused')), 1, 'sempre um ativo só');

select throws_ok($$ insert into public.timers (id, kind, started_at, ends_at) values
  (gen_random_uuid(), 'rest', now(), now()) $$, '42501', null, 'ninguém grava direto');

-- Estranho não vê nem mexe
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.timers), 0, 'estranho não vê os timers dos outros');
select throws_ok($$ select public.update_timer('a0000000-0000-0000-0000-000000000002', 'cancel') $$,
  'P0002', null, 'nem cancela');

select * from finish();
rollback;
