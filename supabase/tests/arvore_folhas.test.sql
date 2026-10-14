-- V3 §1.2 (G2): só folhas dão XP; mãe acompanha as filhas; "Concluir tudo".
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Mudança', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plano');
-- Mudar > Cozinha > (Louça, Panelas)
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Mudar');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cozinha'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Louça'),
  ('c0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Panelas');
reset role;
update public.tasks set created_at = now() - interval '1 hour';
set local role authenticated;

select throws_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000002') $$,
  '22023', null, 'mãe não se conclui com filha pendente');

select ok((public.complete_task('c0000000-0000-0000-0000-000000000003') ->> 'xp')::int > 0, 'folha dá XP');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 'todo',
  'com uma filha aberta, a mãe continua aberta');

select public.complete_task('c0000000-0000-0000-0000-000000000004');
select results_eq(
  $$ select status::text from public.tasks where id in ('c0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002') order by depth $$,
  $$ values ('done'), ('done') $$, 'a última filha fecha a mãe e a avó');
select is((select count(*)::int from public.xp_events where task_id in ('c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002') and amount > 0), 0, 'mãe e avó não dão XP');

select public.uncomplete_task('c0000000-0000-0000-0000-000000000004');
select results_eq(
  $$ select status::text from public.tasks where id in ('c0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002') order by depth $$,
  $$ values ('todo'), ('todo') $$, 'reabrir uma filha reabre a mãe e a avó');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000003'), 'done',
  'a irmã concluída continua concluída');

-- Com o automático desligado, a mãe espera
update public.folders set auto_complete_parent = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.complete_task('c0000000-0000-0000-0000-000000000004');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 'todo',
  'sem o automático, a mãe não fecha sozinha');
select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000002') $$,
  'com as filhas concluídas, a mãe se conclui');

-- "Concluir tudo"
select public.uncomplete_task('c0000000-0000-0000-0000-000000000003');
select public.uncomplete_task('c0000000-0000-0000-0000-000000000002');
select is(public.complete_tree('c0000000-0000-0000-0000-000000000001'), 3, 'concluir tudo fecha o que estava aberto');
select is((select count(*)::int from public.tasks where status <> 'done'), 0, 'o galho inteiro fica concluído');

select * from finish();
rollback;
