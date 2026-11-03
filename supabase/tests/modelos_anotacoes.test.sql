-- OB5 (D290): modelos de anotação, só da dona (a mesma RLS das anotações)
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.notes (id, title, body, is_template) values
  ('dddddddd-0000-0000-0000-000000000005', 'Diário', E'# {{data}}\n\n- ', true) $$,
  'dona cria um modelo');
select is((select count(*)::int from public.notes where is_template), 1, 'e vê o modelo');
select lives_ok($$ update public.notes set is_template = false where id = 'dddddddd-0000-0000-0000-000000000005' $$,
  'e deixa de ser modelo');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.notes set is_template = true;
select is((select count(*)::int from public.notes), 0, 'estranho não vê o modelo');
reset role;
select is((select is_template from public.notes where id = 'dddddddd-0000-0000-0000-000000000005'), false,
  'nem o muda');

select * from finish();
rollback;
