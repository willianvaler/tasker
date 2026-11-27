-- SA5 (D391): tabela nutricional da própria pessoa. A dona cadastra e muda; outra pessoa não vê,
-- não muda nem apaga; base e valores são conferidos; entra na exportação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$insert into public.nutrition_foods (id, name, basis, kcal, protein, carbs, fat)
  values ('f0000000-0000-0000-0000-000000000001', ' Arroz branco ', 'g', 128, 2.5, 28.1, 0.2)$$,
  'a dona cadastra um alimento');
select is((select name from public.nutrition_foods where id = 'f0000000-0000-0000-0000-000000000001'),
  'Arroz branco', 'o nome chega sem espaço nas pontas');
select throws_ok($$insert into public.nutrition_foods (name, basis) values ('Ovo', 'xícara')$$,
  '23514', null, 'base só g, ml ou un');
select throws_ok($$insert into public.nutrition_foods (name, kcal) values ('Ovo', -1)$$,
  '23514', null, 'valor negativo não vale');
select is(public.export_my_data() -> 'nutrition_foods' -> 0 ->> 'name', 'Arroz branco', 'entra na exportação');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.nutrition_foods), 0, 'outra pessoa não vê');
update public.nutrition_foods set kcal = 1;
delete from public.nutrition_foods;
select throws_ok($$insert into public.nutrition_foods (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'X')$$,
  '42501', null, 'nem grava na tabela de outra pessoa');
reset role;
select is((select kcal::int from public.nutrition_foods where id = 'f0000000-0000-0000-0000-000000000001'), 128,
  'nem muda ou apaga');

select * from finish();
rollback;
