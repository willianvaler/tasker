-- GP3 (D315): tarefa ligada a marco do mesmo projeto; marco de fora é recusado; mudar de projeto
-- solta o marco; o lote aceita o marco; apagar o marco solta as tarefas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
insert into public.folders (id, owner_id, name, is_shared) values
  ('f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'App', true),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Outro', true);
insert into public.pages (id, folder_id, name) values
  ('b0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000004', 'Backlog'),
  ('b0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000005', 'Lista');
insert into public.milestones (id, folder_id, name, due_date, position) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', 'v1.0', '2026-12-15', 1),
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', 'Outro marco', null, 1);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.tasks (id, page_id, title, milestone_id)
  values ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000011', 'Login', 'd0000000-0000-0000-0000-000000000001') $$,
  'liga ao marco do projeto');
select throws_ok($$ update public.tasks set milestone_id = 'd0000000-0000-0000-0000-000000000002'
  where id = 'c0000000-0000-0000-0000-000000000011' $$, '22023', null, 'marco de outro projeto é recusado');
select lives_ok($$ select public.create_tasks_batch('b0000000-0000-0000-0000-000000000011',
  '[{"title": "Cadastro", "milestone_id": "d0000000-0000-0000-0000-000000000001"}]') $$, 'o lote aceita o marco');
select is((select count(*)::int from public.tasks where milestone_id = 'd0000000-0000-0000-0000-000000000001'), 2,
  'duas tarefas no marco');
update public.tasks set page_id = 'b0000000-0000-0000-0000-000000000012' where title = 'Cadastro';
select is((select milestone_id from public.tasks where title = 'Cadastro'), null, 'mudou de projeto: solta o marco');
delete from public.milestones where id = 'd0000000-0000-0000-0000-000000000001';
select is((select milestone_id from public.tasks where title = 'Login'), null, 'apagar o marco solta a tarefa');

select * from finish();
rollback;
