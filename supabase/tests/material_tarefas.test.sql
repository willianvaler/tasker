-- ES6 (D327): ligar o material às tarefas. Pelo código (M01 → "M01 · ...", Fase 0 → a lista
-- "Fase 0 · ..."), à mão, desfazer a automática; leitor vê e não liga; estranho não vê; só no mesmo
-- projeto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is(public.material_code('03 - M01 - Assis - Arquimedes.pdf'), 'm01', 'código do material');
select is(public.item_code('Fase 1A · Alavancas e equilíbrio'), 'fase 1a', 'código da lista');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Engenharia', 'project'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Outro', 'project');
insert into public.folders (id, name, parent_id) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Material', 'aaaaaaaa-0000-0000-0000-000000000001');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Fase 0 · Começo'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Fase 1A · Alavancas'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Outra');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'M01 · Balança de régua'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'M02 · Ponte'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'M01 · De outro projeto');
-- O material numa subpasta do projeto: liga às tarefas do projeto inteiro
insert into public.project_files (id, folder_id, kind, path, name, mime, size) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'file',
   'aaaaaaaa-0000-0000-0000-000000000003/dddddddd-0000-0000-0000-000000000001.pdf',
   '03 - M01 - Assis.pdf', 'application/pdf', 1000),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', 'file',
   'aaaaaaaa-0000-0000-0000-000000000003/dddddddd-0000-0000-0000-000000000002.pdf',
   '01 - Fase 0 - Prelúdio.pdf', 'application/pdf', 1000);

select results_eq(
  $$ select material_name, target_kind, target_title, auto from public.material_task_links('aaaaaaaa-0000-0000-0000-000000000001')
     order by material_name $$,
  $$ values ('01 - Fase 0 - Prelúdio.pdf', 'page', 'Fase 0 · Começo', true),
            ('03 - M01 - Assis.pdf', 'task', 'M01 · Balança de régua', true) $$,
  'pelo código: a tarefa e a lista do mesmo projeto (não a do outro)');

-- À mão: o M01 também na M02
select lives_ok($$ insert into public.material_links (material_id, task_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') $$, 'a dona liga à mão');
select is((select folder_id from public.material_links), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'a ligação fica na raiz do projeto');
select throws_ok($$ insert into public.material_links (material_id, task_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003') $$,
  '22023', null, 'tarefa de outro projeto é recusada');
-- Desfazer a automática
insert into public.material_links (material_id, task_id, linked) values
  ('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', false)
on conflict (material_id, task_id) do update set material_id = excluded.material_id, task_id = excluded.task_id, linked = false;
select results_eq(
  $$ select target_title, auto from public.material_task_links('aaaaaaaa-0000-0000-0000-000000000003')
     where material_name like '03%' $$,
  $$ values ('M02 · Ponte', false) $$,
  'a automática desfeita sai, a feita à mão fica');
select is((select count(*)::int from public.material_task_links(null)), 2, 'sem projeto: todas as que vejo');

-- Leitor: vê, não liga
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.material_task_links('aaaaaaaa-0000-0000-0000-000000000001')), 2,
  'leitor vê as ligações');
select throws_ok($$ delete from public.material_links where task_id = 'c0000000-0000-0000-0000-000000000002';
  insert into public.material_links (material_id, task_id) values
  ('dddddddd-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'leitor não liga');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.material_task_links(null)), 0, 'estranho não vê');
select is((select count(*)::int from public.material_links), 0, 'nem a tabela');

select * from finish();
rollback;
