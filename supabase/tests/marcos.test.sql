-- V2 §5 (E6): marcos do projeto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Casa');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

select lives_ok(
  $$ insert into public.milestones (id, folder_id, name, due_date) values
     ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras', current_date + 3) $$,
  'Dono cria marco no projeto');
select throws_ok(
  $$ insert into public.milestones (folder_id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Marco') $$,
  '22023', null, 'pasta comum não tem marco');
update public.milestones set done_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000001';
select isnt((select done_at from public.milestones), null, 'Dono conclui o marco');
select is((select version from public.milestones), 2, 'versão sobe a cada mudança');

-- Leitor vê, mas não mexe
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.milestones), 1, 'Leitor vê o marco');
select throws_ok(
  $$ insert into public.milestones (folder_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bebidas') $$,
  '42501', null, 'Leitor não cria marco');
delete from public.milestones;
select is((select count(*)::int from public.milestones), 1, 'Leitor não apaga marco');

-- Estranho não vê
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.milestones), 0, 'quem não é do projeto não vê');

select * from finish();
rollback;
