-- V3 §2.3 (I7): lista que depende de outra (X%). Mesmos casos de src/lib/__tests__/page-deps.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'colab@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Reforma', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Outro', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alvenaria'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'Acabamento'),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001', 'Vazia'),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000002', 'Longe');
-- Alvenaria: uma mãe com duas filhas (pacote) e uma solta = 3 folhas
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000a', 'Paredes'),
  ('c0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000a', 'Elétrica'),
  ('c0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Pintar');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'Tijolos'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'Reboco');

insert into public.page_dependencies (page_id, depends_on_page_id) values
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000a');

select results_eq($$ select done, total from public.page_progress('bbbbbbbb-0000-0000-0000-00000000000a') $$,
  $$ values (0, 3) $$, 'progresso conta as folhas (a mãe é pacote)');
select is(public.page_blockers('bbbbbbbb-0000-0000-0000-00000000000b'),
  array['bbbbbbbb-0000-0000-0000-00000000000a']::uuid[], 'Acabamento espera a Alvenaria');
select is(public.task_state('c0000000-0000-0000-0000-00000000000b'), 'blocked', 'e as tarefas dela ficam bloqueadas');
select throws_ok($$ select public.complete_task('c0000000-0000-0000-0000-00000000000b') $$, '22023',
  'Lista bloqueada. Aguardando: Alvenaria (100%)', 'não conclui tarefa de lista bloqueada (estrito)');

-- 2 de 3 folhas: 66% não basta para 100%, basta para 50%
select public.complete_task('c0000000-0000-0000-0000-000000000002');
select public.complete_task('c0000000-0000-0000-0000-000000000003');
select is(cardinality(public.page_blockers('bbbbbbbb-0000-0000-0000-00000000000b')), 1, '66% ainda segura a 100%');
update public.page_dependencies set threshold_pct = 50;
select is(public.task_state('c0000000-0000-0000-0000-00000000000b'), 'ready', 'a 50%, libera');
select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-00000000000b') $$, 'e conclui');

-- Lista vazia não segura
insert into public.page_dependencies (page_id, depends_on_page_id) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000c');
select is(cardinality(public.page_blockers('bbbbbbbb-0000-0000-0000-00000000000a')), 0, 'lista vazia não segura');

-- Ciclo e outro projeto
select throws_ok($$ insert into public.page_dependencies (page_id, depends_on_page_id)
  values ('bbbbbbbb-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-00000000000b') $$, '22023',
  'Isso criaria um ciclo: Vazia → Acabamento → Alvenaria → Vazia', 'ciclo recusado com o caminho');
select throws_ok($$ insert into public.page_dependencies (page_id, depends_on_page_id)
  values ('bbbbbbbb-0000-0000-0000-00000000000d', 'bbbbbbbb-0000-0000-0000-00000000000a') $$, '22023',
  'Dependências só entre listas do mesmo projeto', 'só no mesmo projeto');

-- Colaborador vê, mas não liga
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.page_dependencies), 2, 'Colaborador vê as ligações');
select throws_ok($$ insert into public.page_dependencies (page_id, depends_on_page_id)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000c') $$, '42501',
  null, 'Colaborador não liga listas');

select * from finish();
rollback;
