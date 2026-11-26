-- CS4 (D390): despensa. Abaixo do mínimo (ou acabou) põe o item na lista de compras sem duplicar;
-- marcar comprado soma ao estoque; desfazer tira; voltar acima do mínimo tira a compra aberta;
-- quem é do projeto mexe, leitor só vê, estranho não vê.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'beto@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'leitor@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.pages (id, folder_id, name, view_type, config) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Despensa', 'pantry',
   '{"pantry": {"shopping": "bbbbbbbb-0000-0000-0000-000000000002"}}');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
create function pg_temp.shopping() returns int language sql security definer as $$
  select count(*)::int from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status <> 'done'
$$;
create function pg_temp.qty() returns numeric language sql security definer as $$
  select qty from public.pantry_items where id = 'cccccccc-0000-0000-0000-000000000001'
$$;
create function pg_temp.task() returns uuid language sql security definer as $$
  select shopping_task_id from public.pantry_items where id = 'cccccccc-0000-0000-0000-000000000001'
$$;
set local role authenticated;

select lives_ok($$insert into public.pantry_items (id, page_id, name, unit, qty, min_qty, buy_qty) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Arroz', 'kg', 3, 2, 5)$$,
  'a dona cadastra o item');
select is(pg_temp.shopping(), 0, 'com estoque acima do mínimo, não vai para as compras');
select throws_ok($$insert into public.pantry_items (page_id, name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'X')$$,
  '22023', null, 'item só em lista do tipo despensa');

-- Outra pessoa do projeto baixa o estoque: entra nas compras, uma vez
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.pantry_items set qty = 1 where id = 'cccccccc-0000-0000-0000-000000000001';
select is(pg_temp.shopping(), 1, 'abaixo do mínimo: o item entra na lista de compras');
select is((select title from public.tasks where id = pg_temp.task()), 'Arroz (5 kg)', 'com quanto comprar');
update public.pantry_items set qty = 0 where id = 'cccccccc-0000-0000-0000-000000000001';
update public.pantry_items set min_qty = 3 where id = 'cccccccc-0000-0000-0000-000000000001';
select is(pg_temp.shopping(), 1, 'acabou e mudou o mínimo: continua uma compra só');
select throws_ok($$update public.pantry_items set shopping_task_id = null where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  '42501', null, 'o app não mexe na ligação com a compra');

-- Comprado: soma ao estoque e sai das compras
select public.complete_task(pg_temp.task());
select is(pg_temp.qty(), 5::numeric, 'marcar comprado soma ao estoque (0 + 5)');
select is(pg_temp.shopping(), 0, 'e não cria outra (5 já passa do mínimo 3)');
select public.uncomplete_task((select id from public.tasks where page_id = 'bbbbbbbb-0000-0000-0000-000000000002' limit 1));
select is(format('%s %s', pg_temp.qty(), pg_temp.shopping()), '0 1', 'desfazer tira o que somou e a compra volta');

-- Voltar acima do mínimo sem comprar (contou de novo) tira a compra aberta
update public.pantry_items set qty = 10 where id = 'cccccccc-0000-0000-0000-000000000001';
select is(pg_temp.shopping(), 0, 'acima do mínimo de novo: a compra aberta sai');

-- Mínimo 0: só "acabou" põe nas compras
insert into public.pantry_items (id, page_id, name, qty, min_qty) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Sal', 1, 0);
update public.pantry_items set qty = 0 where id = 'cccccccc-0000-0000-0000-000000000002';
select is(pg_temp.shopping(), 1, 'sem mínimo, acabou também entra');

-- Leitor só vê; estranho nem vê
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.pantry_items), 2, 'o leitor vê a despensa');
update public.pantry_items set qty = 99;
select isnt((select qty from public.pantry_items where name = 'Sal'), 99::numeric, 'mas não muda');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.pantry_items), 0, 'o estranho não vê');

-- Apagar o item tira a compra aberta
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.pantry_items where id = 'cccccccc-0000-0000-0000-000000000002';
select is(pg_temp.shopping(), 0, 'apagar o item tira a compra aberta');

-- Os mesmos casos de src/lib/__tests__/pantry.test.ts
select is(public.pantry_buy_title('Sal', 1, ''), 'Sal (1)', 'sem unidade');
select is(public.pantry_buy_title('Leite', 1.5, 'l'), 'Leite (1,5 l)', 'decimal com vírgula');
select is(public.pantry_buy_title('Ovos', 10, 'un'), 'Ovos (10 un)', 'dezena sem cortar o zero');
select is(format('%s %s %s', public.pantry_needs(1, 0), public.pantry_needs(0, 0), public.pantry_needs(10, 3)),
  'f t f', 'mínimo 0 só pede quando acaba');

select * from finish();
rollback;
