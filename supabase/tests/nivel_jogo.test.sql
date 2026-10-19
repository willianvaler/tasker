-- Níveis de jogo (HB3, D195). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

select is((select game_mode from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'light', 'conta nova começa no Leve');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.profiles set game_mode = 'full' where id = '11111111-1111-1111-1111-111111111111';
select is((select game_mode from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'full', 'a pessoa troca o próprio nível');
select throws_ok($$ update public.profiles set game_mode = 'turbo'
  where id = '11111111-1111-1111-1111-111111111111' $$, '23514', null, 'só light ou full');

update public.profiles set game_mode = 'full' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select game_mode from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'light', 'não troca o de outra pessoa');
select is((select gamification_enabled from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  true, 'o Completo não mexe no liga/desliga');

select * from finish();
rollback;
