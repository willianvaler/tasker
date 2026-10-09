-- Fase 6: kanban. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Trabalho');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Quadro', 'kanban');
insert into public.tasks (id, page_id, title) values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Relatório');
reset role;
update public.tasks set created_at = now() - interval '1 hour';
set local role authenticated;

select is(public.set_task_status('cccccccc-0000-0000-0000-000000000001', 'doing') #>> '{task,status}', 'doing', 'A fazer → Fazendo');
select is((select xp from public.profiles where id = auth.uid()), 0, 'Fazendo não dá XP');
select is((public.set_task_status('cccccccc-0000-0000-0000-000000000001', 'done') ->> 'xp')::int, 10, 'Fazendo → Feito conclui e dá XP');
select is((select count(*)::int from public.task_completions), 1, 'e entra no histórico');
select is(public.set_task_status('cccccccc-0000-0000-0000-000000000001', 'doing') #>> '{task,status}', 'doing', 'Feito → Fazendo');
select is((select xp from public.profiles where id = auth.uid()), 0, 'sair de Feito devolve o XP');
select throws_ok($$ update public.tasks set status = 'todo' $$, '42501', null, 'status continua só por função');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.set_task_status('cccccccc-0000-0000-0000-000000000001', 'todo') $$, 'P0002', null,
  'quem não é do projeto não mexe');

select * from finish();
rollback;
