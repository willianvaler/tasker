-- V4 §3 (Q1, D181): itens com a escala de 5 raridades; inventário só pela própria pessoa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is((select count(*)::int from public.items where rarity = 'uncommon'), 4,
  'os 4 raros de 120 de ouro viraram incomuns');
select lives_ok($$update public.items set rarity = 'uncommon' where key = 'helmet'$$,
  'incomum é uma raridade válida');
select throws_ok($$update public.items set rarity = 'mythic' where key = 'helmet'$$, '23514', null,
  'raridade fora da escala é recusada');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
insert into public.user_items (user_id, item_key, source) values
  ('22222222-2222-2222-2222-222222222222', 'helmet', 'shop');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.user_items), 0, 'ninguém vê o inventário dos outros');
select throws_ok($$insert into public.user_items (user_id, item_key, source)
                   values ('11111111-1111-1111-1111-111111111111', 'crown', 'drop')$$, '42501', null,
  'e ninguém se dá um item direto');
reset role;

select * from finish();
rollback;
