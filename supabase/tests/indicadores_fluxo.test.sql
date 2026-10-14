-- V3 §2.7 (I6): tempos médios do fluxo a partir da auditoria.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'colab@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor');

-- Eventos com horas conhecidas (como superusuário: ninguém grava na mão)
insert into public.task_events (task_id, root_id, kind, at) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'created', now() - interval '5 hours'),
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'blocked', now() - interval '5 hours'),
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ready', now() - interval '3 hours'),
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'started', now() - interval '2 hours'),
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'completed', now() - interval '30 minutes'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'blocked', now() - interval '4 hours'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'ready', now() - interval '3 hours');

set local role authenticated;
select is((public.project_flow_stats('aaaaaaaa-0000-0000-0000-000000000001') -> 'waiting' ->> 'minutes')::int, 90,
  'espera média: (120 + 60) / 2 min');
select is((public.project_flow_stats('aaaaaaaa-0000-0000-0000-000000000001') -> 'waiting' ->> 'count')::int, 2,
  'conta as duas esperas');
select is((public.project_flow_stats('aaaaaaaa-0000-0000-0000-000000000001') -> 'to_start' ->> 'minutes')::int, 60,
  'da liberação ao início: 60 min');
select is((public.project_flow_stats('aaaaaaaa-0000-0000-0000-000000000001') -> 'doing' ->> 'minutes')::int, 90,
  'fazendo: 90 min');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.project_flow_stats('aaaaaaaa-0000-0000-0000-000000000001') $$, '42501',
  null, 'Colaborador não vê os indicadores de tempo');

select * from finish();
rollback;
