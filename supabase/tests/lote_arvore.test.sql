-- V3 §1.1 (G6): o lote cria a árvore inteira; o limite continua valendo no servidor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name, max_depth) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plano', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Curta', 2);

select is(
  (select count(*)::int from public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
    '[{"title": "Mudar", "children": [{"title": "Cozinha", "children": [{"title": "Louça"}, {"title": "Copos"}]}, {"title": "Sala"}]}]')),
  5, 'lote cria os cinco itens');
select results_eq(
  $$ select title, depth::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     order by depth, position $$,
  $$ values ('Mudar', 1), ('Cozinha', 2), ('Sala', 2), ('Louça', 3), ('Copos', 3) $$,
  'com a árvore e a ordem certas');
select throws_ok(
  $$ select * from public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002',
     '[{"title": "A", "children": [{"title": "B", "children": [{"title": "C"}]}]}]') $$,
  '22023', null, 'o limite da página vale também no lote');

select * from finish();
rollback;
