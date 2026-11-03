-- OB8 e OB10 (D293, D295): listas do tipo base e canvas, com a configuração em pages.config.
-- Dono grava, leitor vê e não grava, estranho não vê; config precisa ser objeto e tem teto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

select lives_ok($$ insert into public.pages (id, folder_id, name, view_type, config) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Base da casa', 'base',
   '{"query": "tarefas onde etiqueta = casa", "view": "table", "columns": ["due", "priority"]}') $$,
  'dono cria uma base');
select lives_ok($$ insert into public.pages (id, folder_id, name, view_type, config) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Mapa', 'canvas',
   '{"nodes": [{"id": "a", "type": "text", "x": 0, "y": 0, "width": 240, "height": 120, "text": "Oi"}], "edges": []}') $$,
  'e um canvas');
select lives_ok($$ update public.pages set config = jsonb_set(config, '{view}', '"cards"')
  where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$, 'dono muda a visão');
select throws_ok($$ update public.pages set config = '[1, 2]' where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  '23514', null, 'config tem de ser um objeto');
select throws_ok($$ update public.pages set config = jsonb_build_object('text', repeat('x', 1000001))
  where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$, '23514', null, 'e tem teto de tamanho');

-- Leitor vê a configuração, mas não grava
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select config ->> 'view' from public.pages where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'cards',
  'leitor vê a base');
update public.pages set config = '{"nodes": [], "edges": []}' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select jsonb_array_length(config -> 'nodes') from public.pages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  1, 'leitor não mexe no canvas');

-- Estranho não vê nem grava
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.pages where view_type in ('base', 'canvas')), 0, 'estranho não vê');
update public.pages set config = '{}';
reset role;
select is((select config -> 'nodes' -> 0 ->> 'text' from public.pages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'Oi', 'nem muda o canvas');

select * from finish();
rollback;
