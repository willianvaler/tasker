-- W3: anotações só de quem escreveu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.notes (id, title, body) values
  ('dddddddd-0000-0000-0000-000000000001', 'Mercado', 'leite, pão') $$, 'dona escreve');
select is((select user_id from public.notes), '11111111-1111-1111-1111-111111111111'::uuid, 'a nota é de quem escreveu');
select throws_ok($$ insert into public.notes (title, body) values ('x', repeat('a', 20001)) $$,
  '23514', null, 'no máximo 20 mil caracteres');
update public.notes set body = 'leite, pão, café';
select is((select body from public.notes), 'leite, pão, café', 'dona edita');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notes), 0, 'estranho não vê');
update public.notes set body = 'invadido';
reset role;
select is((select body from public.notes), 'leite, pão, café', 'estranho não edita');

select * from finish();
rollback;
