-- ESCOPO_V10 CM1 (D233): publicar, usar, curtir, denunciar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'davi@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, icon) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Cardápio', '🥗');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Semana', 'list'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contas', 'expenses');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Lasanha", "due_date": "2026-10-20",
     "children": [{"title": "500 g carne"}, {"title": "Molho", "children": [{"title": "2 tomates"}]}]}]');
update public.tasks set notes = '- sal' where id = 'c0000000-0000-0000-0000-000000000001';

create temp table post as select public.community_publish('menu', 'Cardapio pgtap zq', 'Fácil', '🥗',
  'aaaaaaaa-0000-0000-0000-000000000001') as id;
grant select on post to authenticated;
select is((select jsonb_array_length(data -> 'pages') from public.community_posts where id = (select id from post)), 1, 'página de gastos fica de fora');
select is((select data #>> '{pages,0,items,0,notes}' from public.community_posts where id = (select id from post)), '- sal', 'leva as notas');
select is((select data #>> '{pages,0,items,0,children,1,children,0,title}' from public.community_posts where id = (select id from post)), '2 tomates',
  'leva as subtarefas em vários níveis');
select ok((select not (data #> '{pages,0,items,0}') ? 'due_date' from public.community_posts where id = (select id from post)), 'sem datas');
select throws_ok($$ insert into public.community_posts (kind, title, data) values ('list', 'x', '{"pages": []}') $$,
  '42501', null, 'escrita só por RPC');
select throws_ok($$ select public.community_publish('list', 'Alheia', null, null, null, 'bbbbbbbb-0000-0000-0000-000000000009') $$,
  'P0002', null, 'página que não vejo não se publica');

-- Bia vê, usa e curte
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select author_username from public.community_feed('pgtap zq')), 'ana', 'aparece no feed com o nick');
select is((select items from public.community_feed('pgtap zq')), 1, 'busca no título e conta itens');
select is((select count(*)::int from public.community_feed('pgtap zq', 'workout')), 0, 'filtro por tipo');
create temp table used as select public.community_use((select id from post)) as folder;
grant select on used to authenticated;
select is((select count(*)::int from public.tasks t join public.pages p on p.id = t.page_id
  where p.folder_id = (select folder from used)), 4, 'usar cria a pasta com as tarefas e subtarefas');
select is((select notes from public.tasks t join public.pages p on p.id = t.page_id
  where p.folder_id = (select folder from used) and t.parent_task_id is null), '- sal', 'as notas vêm junto');
select is((select uses from public.community_feed('pgtap zq')), 1, 'conta um uso');
select is(public.community_like((select id from post), true), 1, 'curte');
select is(public.community_like((select id from post), true), 1, 'curtir de novo não soma');

-- Três denúncias ocultam; o autor ainda vê
select public.community_report((select id from post), 'spam');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.community_report((select id from post));
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.community_report((select id from post));
select is((select count(*)::int from public.community_feed('pgtap zq')), 0, 'com 3 denúncias some');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.community_feed('pgtap zq', null, null, 'new', 30, 0, true)), 1, 'o autor ainda vê a sua');
select public.community_unpublish((select id from post));
select is((select count(*)::int from public.community_posts where id = (select id from post)), 0, 'despublicar apaga');

select * from finish();
rollback;
