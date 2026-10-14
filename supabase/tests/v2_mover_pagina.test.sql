-- C3: mover página entre pastas leva as tarefas. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.folders (id, name) values ('cccccccc-0000-0000-0000-000000000001', 'Da Bia');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Mercado'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Casa');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lista');
insert into public.tasks (id, page_id, title) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Arroz');

select lives_ok(
  $$ update public.pages set folder_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'move a página para outra pasta sua');
select is((select folder_id from public.tasks where id = 'dddddddd-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'a tarefa vai junto');

select throws_ok(
  $$ update public.pages set folder_id = 'cccccccc-0000-0000-0000-000000000001'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '42501', null, 'não move para a pasta de outra pessoa');
select is((select folder_id from public.pages where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'e a página continua onde estava');

select * from finish();
rollback;
