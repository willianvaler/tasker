-- V2 §5: pasta × projeto. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
select is((select kind from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'folder',
  'pasta nova é pasta');

insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Churrasco', 'project');
select is((select kind from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'project',
  'cria projeto direto');

select throws_ok(
  $$ insert into public.folders (name, parent_id, kind)
     values ('Sub', 'aaaaaaaa-0000-0000-0000-000000000002', 'project') $$,
  '23514', null, 'projeto não pode ser subpasta');

select lives_ok(
  $$ update public.folders set kind = 'project' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'pasta vira projeto');
select lives_ok(
  $$ update public.folders set kind = 'folder' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'e volta a ser pasta');

-- Compartilhar (criar convite) transforma em projeto
select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'editor');
select is((select kind from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'project',
  'compartilhar vira projeto');

update public.folders set kind = 'folder' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select kind from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'project',
  'projeto compartilhado não volta a ser pasta');

select * from finish();
rollback;
