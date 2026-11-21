-- AG1 (D310): disponibilidade da agenda. Só a dona vê e muda; a semana troca inteira pelo
-- set_availability, que recusa sobreposição; exceções com dia inteiro ou trecho; entra na exportação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok($$ select public.set_availability('[
  {"weekday": 1, "starts": "09:00", "ends": "12:00"},
  {"weekday": 1, "starts": "14:00", "ends": "18:00"},
  {"weekday": 3, "starts": "09:00", "ends": "12:00"}]') $$, 'grava a semana');
select is((select count(*)::int from public.availability_rules), 3, 'três trechos');
select throws_ok($$ select public.set_availability('[
  {"weekday": 2, "starts": "09:00", "ends": "12:00"},
  {"weekday": 2, "starts": "11:00", "ends": "13:00"}]') $$, '23514', null, 'sobreposição no mesmo dia é recusada');
select is((select count(*)::int from public.availability_rules), 3, 'recusada, a semana fica como estava');
select throws_ok($$ select public.set_availability('[{"weekday": 8, "starts": "09:00", "ends": "12:00"}]') $$,
  '23514', null, 'dia de 1 a 7');
select throws_ok($$ select public.set_availability('[{"weekday": 1, "starts": "12:00", "ends": "09:00"}]') $$,
  '23514', null, 'começo antes do fim');
select throws_ok($$ update public.availability_rules set ends = '20:00' $$, '42501', null,
  'trecho não se edita direto (só pela semana)');

select lives_ok($$ insert into public.availability_exceptions (starts_on, ends_on, note)
  values ('2026-12-24', '2026-12-26', 'Natal') $$, 'exceção de dias inteiros');
select lives_ok($$ insert into public.availability_exceptions (starts_on, ends_on, starts, ends)
  values ('2026-12-01', '2026-12-01', '14:00', '15:00') $$, 'exceção de um trecho');
select throws_ok($$ insert into public.availability_exceptions (starts_on, ends_on, starts)
  values ('2026-12-02', '2026-12-02', '14:00') $$, '23514', null, 'trecho precisa de começo e fim');
select throws_ok($$ insert into public.availability_exceptions (user_id, starts_on, ends_on)
  values ('33333333-3333-3333-3333-333333333333', '2026-12-02', '2026-12-02') $$, '42501', null,
  'não grava em nome de outra pessoa');
select ok(jsonb_array_length(public.export_my_data() -> 'availability_rules') = 3
  and jsonb_array_length(public.export_my_data() -> 'availability_exceptions') = 2, 'entra na exportação');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.availability_rules) + (select count(*)::int from public.availability_exceptions),
  0, 'ninguém mais vê');
select public.set_availability('[]');
delete from public.availability_exceptions;

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.availability_rules) + (select count(*)::int from public.availability_exceptions),
  5, 'estranho não apaga a semana nem as exceções');

select * from finish();
rollback;
