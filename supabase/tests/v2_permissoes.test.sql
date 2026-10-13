-- V2 §4.3 / V3 §8: permissões como dados. Mesmos casos de src/lib/__tests__/permissions.test.ts.
-- Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select is(public.preset_can('owner', 'project.delete'), true, 'owner → project.delete');
select is(public.preset_can('manager', 'project.delete'), false, 'manager não exclui o projeto');
select is(public.preset_can('manager', 'member.manage'), true, 'manager → member.manage');
select is(public.preset_can('editor', 'member.manage'), false, 'editor não mexe em pessoas');
select is(public.preset_can('editor', 'task.edit'), true, 'editor → task.edit');
select is(public.preset_can('editor', 'automation.manage'), false, 'editor não mexe em automações');
select is(public.preset_can('editor', 'workflow.view_audit'), true, 'editor vê a auditoria');
select is(public.preset_can('contributor', 'task.create'), true, 'colaborador cria');
select is(public.preset_can('contributor', 'task.edit'), false, 'colaborador não edita de outros');
select is(public.preset_can('viewer', 'comment.create'), true, 'leitor comenta');
select is(public.preset_can('viewer', 'task.create'), false, 'leitor não cria');
select is(public.preset_can('executor', 'item.check'), true, 'executor marca');
select is(public.preset_can('executor', 'task.create'), false, 'executor não cria');

select is(public.preset_can('contributor', 'task.complete', true), true, 'colaborador conclui a atribuída a si');
select is(public.preset_can('contributor', 'task.complete'), false, 'mas não a dos outros');
select is(public.preset_can('contributor', 'task.delete', false, true), true, 'apaga o que criou');
select is(public.preset_can('contributor', 'task.delete', true, false), false, 'atribuída não basta para apagar');
select is(public.preset_can('contributor', 'task.edit', true, true), false, '":own" só nas permissões com regra');
select is(public.preset_can('nao-existe', 'project.view'), false, 'preset desconhecido não pode nada');

-- has_permission: pelo papel na pasta raiz
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.folders (id, parent_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cozinha');
select is(public.has_permission('aaaaaaaa-0000-0000-0000-000000000002', 'project.delete'), true,
  'dono da raiz pode tudo na subpasta');

reset role;
insert into public.folder_members (folder_id, user_id, role)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.has_permission('aaaaaaaa-0000-0000-0000-000000000002', 'task.create'), false,
  'leitor não cria');
select is(public.has_permission('aaaaaaaa-0000-0000-0000-000000000002', 'comment.create'), true,
  'leitor comenta');

select * from finish();
rollback;
