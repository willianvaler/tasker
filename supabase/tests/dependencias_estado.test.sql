-- V3 §2.2 (H2): estados derivados. Os mesmos casos de src/lib/__tests__/task-state.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000001', 'a'),
  ('c0000000-0000-0000-0000-0000000000ca', 'bbbbbbbb-0000-0000-0000-000000000001', 'carvão'),
  ('c0000000-0000-0000-0000-0000000000f0', 'bbbbbbbb-0000-0000-0000-000000000001', 'fogo'),
  ('c0000000-0000-0000-0000-0000000000ce', 'bbbbbbbb-0000-0000-0000-000000000001', 'carne'),
  ('c0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'b'),
  ('c0000000-0000-0000-0000-000000000099', 'bbbbbbbb-0000-0000-0000-000000000001', 'x'),
  ('c0000000-0000-0000-0000-0000000000aa', 'bbbbbbbb-0000-0000-0000-000000000001', 'mãe'),
  ('c0000000-0000-0000-0000-0000000000ee', 'bbbbbbbb-0000-0000-0000-000000000001', 'pré');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-0000000000ff', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000aa', 'filha');
insert into public.task_dependencies (task_id, depends_on_task_id, lag_minutes) values
  ('c0000000-0000-0000-0000-0000000000f0', 'c0000000-0000-0000-0000-0000000000ca', 0),
  ('c0000000-0000-0000-0000-0000000000ce', 'c0000000-0000-0000-0000-0000000000f0', 30),
  ('c0000000-0000-0000-0000-000000000099', 'c0000000-0000-0000-0000-00000000000a', 0),
  ('c0000000-0000-0000-0000-000000000099', 'c0000000-0000-0000-0000-0000000000b1', 0),
  ('c0000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-0000000000ee', 0);

-- Datas manipuladas como superusuário (o guarda de permissão não vale para ele)
reset role;
select is(public.task_state('c0000000-0000-0000-0000-00000000000a'), 'ready', 'sem pré-requisito: pronta');
update public.tasks set started_at = now() where id = 'c0000000-0000-0000-0000-00000000000a';
select is(public.task_state('c0000000-0000-0000-0000-00000000000a'), 'doing', 'iniciada: em andamento');

select is(public.task_state('c0000000-0000-0000-0000-0000000000f0'), 'blocked', 'fogo bloqueado pelo carvão');
select is(public.task_blockers('c0000000-0000-0000-0000-0000000000f0'),
  array['c0000000-0000-0000-0000-0000000000ca']::uuid[], 'e diz pelo quê');
update public.tasks set status = 'done', completed_at = now() - interval '1 minute' where id = 'c0000000-0000-0000-0000-0000000000ca';
select is(public.task_state('c0000000-0000-0000-0000-0000000000f0'), 'ready', 'carvão comprado: fogo pronto');

-- Atraso de 30 min
update public.tasks set status = 'done', completed_at = now() - interval '10 minutes' where id = 'c0000000-0000-0000-0000-0000000000f0';
select is(public.task_state('c0000000-0000-0000-0000-0000000000ce'), 'blocked', 'concluído há 10 min, espera de 30: bloqueada');
update public.tasks set completed_at = now() - interval '31 minutes' where id = 'c0000000-0000-0000-0000-0000000000f0';
select is(public.task_state('c0000000-0000-0000-0000-0000000000ce'), 'ready', 'depois do atraso: pronta');

-- Todas × qualquer uma (a concluída, b aberta)
update public.tasks set status = 'done', completed_at = now() - interval '1 minute' where id = 'c0000000-0000-0000-0000-00000000000a';
select is(public.task_state('c0000000-0000-0000-0000-000000000099'), 'blocked', 'modo todas: bloqueada');
update public.tasks set deps_mode = 'any' where id = 'c0000000-0000-0000-0000-000000000099';
select is(public.task_state('c0000000-0000-0000-0000-000000000099'), 'ready', 'modo qualquer uma: pronta');

-- A filha herda o bloqueio da mãe
select is(public.task_state('c0000000-0000-0000-0000-0000000000ff'), 'blocked', 'filha herda o bloqueio da mãe');

-- Reaberto volta a bloquear, mesmo iniciada
update public.tasks set status = 'todo', completed_at = null where id = 'c0000000-0000-0000-0000-0000000000f0';
update public.tasks set started_at = now() where id = 'c0000000-0000-0000-0000-0000000000f0';
update public.tasks set status = 'todo', completed_at = null where id = 'c0000000-0000-0000-0000-0000000000ca';
select is(public.task_state('c0000000-0000-0000-0000-0000000000f0'), 'blocked', 'pré-requisito reaberto volta a bloquear');

delete from public.tasks where id = 'c0000000-0000-0000-0000-0000000000ca';
select is(public.task_state('c0000000-0000-0000-0000-0000000000f0'), 'doing', 'pré-requisito apagado não segura');

select * from finish();
rollback;
