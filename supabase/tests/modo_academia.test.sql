-- V6 AC1.1/AC1.5: modo academia, pasta de sistema Academia e preferências da interface.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select gym_enabled from public.profiles where id = auth.uid()), null::boolean,
  'conta nova ainda não respondeu');
select is((select ui_prefs from public.profiles where id = auth.uid()), '{}'::jsonb, 'prefs começam vazias');

select isnt(public.set_gym_mode(true), null::uuid, 'ligar devolve a pasta');
select is((select gym_enabled from public.profiles where id = auth.uid()), true, 'modo ligado');
select is((select count(*)::int from public.folders where is_gym), 1, 'uma pasta Academia');
select is((select name || '|' || kind || '|' || coalesce(parent_id::text, '-') from public.folders where is_gym),
  'Academia|folder|-', 'pasta pessoal na raiz');
select is(public.set_gym_mode(true), (select id from public.folders where is_gym), 'ligar de novo não duplica');

select is(public.set_gym_mode(false), (select id from public.folders where is_gym), 'desligar mantém a pasta');
select is((select gym_enabled from public.profiles where id = auth.uid()), false, 'modo desligado');

select throws_ok($$ update public.folders set kind = 'project' where is_gym $$, '22023', null,
  'Academia não vira projeto');
select throws_ok($$ update public.profiles set gym_enabled = true where id = auth.uid() $$, '42501', null,
  'gym_enabled só pela RPC');
select throws_ok($$ insert into public.folders (name, is_gym) values ('Outra', true) $$, '42501', null,
  'is_gym não se escreve');

update public.profiles set ui_prefs = '{"sidebar": {"order": ["gym", "folders"]}}' where id = auth.uid();
select throws_ok($$ update public.profiles set ui_prefs = '[]' where id = auth.uid() $$, '23514', null,
  'prefs precisam ser objeto');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.profiles set ui_prefs = '{"x": 1}' where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.folders where is_gym), 0, 'estranho não vê a Academia');
reset role;
select is((select ui_prefs -> 'sidebar' -> 'order' ->> 0 from public.profiles
           where id = '11111111-1111-1111-1111-111111111111'), 'gym', 'estranho não muda as prefs');

select * from finish();
rollback;
