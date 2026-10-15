-- V3 §2.8 (M6): automações "quando… então…".
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dia'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Depois');
insert into public.tasks (id, page_id, title, due_date) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assar a carne', null),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Pagar o açougue', '2020-01-01');

insert into public.automation_rules (folder_id, page_id, trigger, action, params) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'task_done', 'create_task',
   '{"title": "Limpar a churrasqueira", "page_id": "bbbbbbbb-0000-0000-0000-000000000002"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'task_done', 'move', '{"page_id": "99999999-0000-0000-0000-000000000000"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'page_done', 'notify', '{"to": "creator", "message": "Dia fechado"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'task_overdue', 'add_label', '{"label": "#atrasada"}');

select lives_ok($$ select public.complete_task('c0000000-0000-0000-0000-000000000001') $$,
  'concluir funciona mesmo com uma ação que falha');
select is((select count(*)::int from public.tasks where title = 'Limpar a churrasqueira'), 1,
  'a automação criou a tarefa seguinte');
select is((select status::text from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'done',
  'a conclusão de quem disparou ficou');
select ok(exists (select 1 from public.automation_log where not ok), 'a ação que falhou ficou no registro');
select is((select count(*)::int from public.notifications where kind = 'automation'), 1, 'página concluída notifica');

-- Prazo vencido: roda uma vez (e não de novo na mesma janela)
reset role;
select is(public.run_overdue_automations(), 1, 'tarefa vencida dispara');
select is(public.run_overdue_automations(), 0, 'e não repete');
select ok((select 'atrasada' = any (labels) from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'),
  'pôs a etiqueta');
set local role authenticated;

-- Leitor não cria; limite de 20
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ insert into public.automation_rules (folder_id, trigger, action) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify') $$, '42501', null, 'Leitor não cria automação');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ insert into public.automation_rules (folder_id, trigger, action)
  select 'aaaaaaaa-0000-0000-0000-000000000001', 'task_done', 'notify' from generate_series(1, 20) $$,
  '22023', null, 'no máximo 20 por projeto');

select * from finish();
rollback;
