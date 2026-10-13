-- V2 §11: idioma no perfil. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select locale from public.profiles where id = auth.uid()), null, 'conta nova segue o aparelho');
select lives_ok($$ update public.profiles set locale = 'es' where id = auth.uid() $$, 'escolhe espanhol');
select is((select locale from public.profiles where id = auth.uid()), 'es', 'e fica salvo');
select throws_ok($$ update public.profiles set locale = 'fr' where id = auth.uid() $$, '23514', null,
  'idioma fora da lista é recusado');

update public.profiles set locale = 'en' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select locale from public.profiles where id = '22222222-2222-2222-2222-222222222222'), null,
  'não muda o idioma de outra pessoa');

select * from finish();
rollback;
