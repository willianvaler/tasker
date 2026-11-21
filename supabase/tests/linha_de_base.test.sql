-- GP2 (D314): linha de base. Só pelo save_baseline (page.manage), foto das tarefas com vencimento
-- fora das reuniões, até 5 por projeto; quem é do projeto vê, estranho não; Colaborador não salva.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('55555555-5555-5555-5555-555555555555', 'colab@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
insert into public.folders (id, owner_id, name, is_shared) values
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Obra', true);
insert into public.folder_members (folder_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'contributor');
insert into public.pages (id, folder_id, name) values
  ('b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 'Etapas');
insert into public.pages (id, folder_id, name, view_type) values
  ('b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'Semanal', 'meeting');
insert into public.tasks (id, page_id, title, start_date, due_date, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fundação', '2026-12-01', '2026-12-05', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Paredes', null, '2026-12-10', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Sem data', null, null, '11111111-1111-1111-1111-111111111111');
insert into public.tasks (page_id, title, due_date, created_by) values
  ('b0000000-0000-0000-0000-000000000002', 'Item da pauta', '2026-12-02', '11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.save_baseline('f0000000-0000-0000-0000-000000000003', 'Plano aprovado') $$, 'a dona salva');
select is((select items from public.baselines),
  '[{"t": "c0000000-0000-0000-0000-000000000001", "s": "2026-12-01", "e": "2026-12-05"},
    {"t": "c0000000-0000-0000-0000-000000000002", "s": "2026-12-10", "e": "2026-12-10"}]'::jsonb,
  'só as tarefas com vencimento, fora da reunião; sem início, o começo é o vencimento');
select throws_ok($$ insert into public.baselines (folder_id, name) values ('f0000000-0000-0000-0000-000000000003', 'x') $$,
  '42501', null, 'não grava direto');
select throws_ok($$ select public.save_baseline('f0000000-0000-0000-0000-000000000003', '  ') $$,
  '23514', null, 'nome obrigatório');
select public.save_baseline('f0000000-0000-0000-0000-000000000003', 'v' || g) from generate_series(2, 5) g;
select throws_ok($$ select public.save_baseline('f0000000-0000-0000-0000-000000000003', 'sexta') $$,
  '23514', null, 'até 5 por projeto');

set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is((select count(*)::int from public.baselines), 5, 'o Colaborador vê');
select throws_ok($$ select public.save_baseline('f0000000-0000-0000-0000-000000000003', 'meu') $$,
  '42501', null, 'o Colaborador não salva');
delete from public.baselines;
select is((select count(*)::int from public.baselines), 5, 'nem apaga');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.baselines), 0, 'estranho não vê');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.baselines where name = 'v5';
select is((select count(*)::int from public.baselines), 4, 'a dona apaga');

select * from finish();
rollback;
