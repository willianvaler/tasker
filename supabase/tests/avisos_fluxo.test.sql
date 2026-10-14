-- V3 §2.2 (H4): avisos de desbloqueio e de pré-requisito reaberto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'willian@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'greg@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-0000000000ca', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar carvão'),
  ('c0000000-0000-0000-0000-0000000000f0', 'bbbbbbbb-0000-0000-0000-000000000001', 'Acender o fogo'),
  ('c0000000-0000-0000-0000-0000000000ce', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assar a carne');
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-0000000000ca', '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-0000000000f0', '11111111-1111-1111-1111-111111111111');
insert into public.task_dependencies (task_id, depends_on_task_id, lag_minutes) values
  ('c0000000-0000-0000-0000-0000000000f0', 'c0000000-0000-0000-0000-0000000000ca', 0),
  ('c0000000-0000-0000-0000-0000000000ce', 'c0000000-0000-0000-0000-0000000000f0', 30);
reset role;
update public.tasks set created_at = now() - interval '1 hour';
set local role authenticated;

-- O Greg compra o carvão: o Willian é avisado
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task('c0000000-0000-0000-0000-0000000000ca');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select payload ->> 'prereq' from public.notifications where kind = 'task_ready'), 'Comprar carvão',
  'quem vai fazer é avisado do desbloqueio');
select is((select payload ->> 'title' from public.notifications where kind = 'task_ready'), 'Acender o fogo',
  'com a tarefa liberada');

-- O Willian acende o fogo: a carne (sem responsável) avisa quem criou... que é ele mesmo: não avisa
select public.complete_task('c0000000-0000-0000-0000-0000000000f0');
select is((select count(*)::int from public.notifications where kind = 'task_ready'), 1,
  'quem fez a ação não é avisado');

-- Reabrir com a carne já iniciada avisa quem cuida dela (o Greg, agora responsável)
reset role;
update public.tasks set started_at = now(), status = 'doing' where id = 'c0000000-0000-0000-0000-0000000000ce';
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-0000000000ce', '22222222-2222-2222-2222-222222222222');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.uncomplete_task('c0000000-0000-0000-0000-0000000000f0');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select payload ->> 'title' from public.notifications where kind = 'prereq_reopened'), 'Assar a carne',
  'reabrir avisa quem já tinha começado');
select is((select payload ->> 'prereq' from public.notifications where kind = 'prereq_reopened'), 'Acender o fogo',
  'dizendo o que foi reaberto');

-- Concluir de novo: a carne tem atraso de 30 min; o aviso sai com o atraso
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task('c0000000-0000-0000-0000-0000000000f0');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select (payload ->> 'lag')::int from public.notifications where kind = 'task_ready'
  and payload ->> 'title' = 'Assar a carne'), 30, 'aviso com o atraso');

select * from finish();
rollback;
