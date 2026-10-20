-- ESCOPO_V10 VI1 (D232): tarefas privadas, só para amigos e públicas; leitura pelo profile_tasks.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Pessoal'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Projeto');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Metas'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Obra');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Correr 5 km", "visibility": "public"},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Ler 1 livro", "visibility": "friends"},
    {"id": "c0000000-0000-0000-0000-000000000003", "title": "Segredo"},
    {"id": "c0000000-0000-0000-0000-000000000004", "title": "Inválida", "visibility": "todo mundo"}]');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002',
  '[{"id": "c0000000-0000-0000-0000-000000000005", "title": "Comprar piso", "visibility": "public"}]');
select is((select visibility from public.tasks where id = 'c0000000-0000-0000-0000-000000000003'), 'private',
  'sem marcador: privada');
select is((select visibility from public.tasks where id = 'c0000000-0000-0000-0000-000000000004'), 'private',
  'valor estranho vira privada');
select lives_ok($$ update public.tasks set visibility = 'friends' where id = 'c0000000-0000-0000-0000-000000000003' $$,
  'dona muda o marcador');
update public.tasks set visibility = 'private' where id = 'c0000000-0000-0000-0000-000000000003';
-- O projeto é compartilhado com a Bia: a tarefa pública dele não aparece no perfil
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'editor');
update public.folders set kind = 'project', is_shared = true where id = 'aaaaaaaa-0000-0000-0000-000000000002';
set local role authenticated;
select public.friend_request('bia');

-- Caio (não é amigo): só a pública da pasta pessoal; não vê a tarefa pela RLS
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select jsonb_agg(x ->> 'title') from jsonb_array_elements(public.profile_tasks('ana') -> 'tasks') x),
  '["Correr 5 km"]'::jsonb, 'quem não é amigo vê só a pública');
select is((select count(*)::int from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 0,
  'pela tabela, nada (a RLS não abre)');
select is(public.profile_tasks('ana') -> 'tasks' -> 0 ->> 'page', 'Metas', 'vem o nome da página');
select ok(not (public.profile_tasks('ana') -> 'tasks' -> 0) ? 'notes', 'sem notas');
select is(public.profile_tasks('ninguem'), null, 'nick que não existe');

-- Bia aceita: vê também a de amigos; a do projeto não sai pelo perfil
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select jsonb_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(public.profile_tasks('ana') -> 'tasks') x),
  '["Correr 5 km"]'::jsonb, 'pedido pendente ainda não abre as de amigos');
select public.friend_respond('11111111-1111-1111-1111-111111111111', true);
select is((select jsonb_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(public.profile_tasks('ana') -> 'tasks') x),
  '["Correr 5 km", "Ler 1 livro"]'::jsonb, 'amiga vê pública e de amigos, não a privada nem a do projeto');
select is(public.profile_tasks('ana') ->> 'friendship', 'accepted', 'o perfil diz que são amigas');

select * from finish();
rollback;
