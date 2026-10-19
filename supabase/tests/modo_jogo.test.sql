-- Modo jogo Completo (ESCOPO_V8, HB5 a HB10; D199 a D205). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
update public.profiles set game_mode = 'full' where id = '11111111-1111-1111-1111-111111111111';

-- Uma diária pessoal (recorrente) vencida ontem e ainda aberta
create temp table ctx as
select p.id as inbox, public.user_today('11111111-1111-1111-1111-111111111111') as today
from public.pages p join public.folders f on f.id = p.folder_id
where f.owner_id = '11111111-1111-1111-1111-111111111111' and p.is_inbox;
grant select on ctx to authenticated;
insert into public.tasks (id, page_id, title, recurrence, due_date, priority, created_by) values
  ('d0000000-0000-0000-0000-000000000001', (select inbox from ctx), 'Alongar', '{"type": "daily"}',
   (select today - 1 from ctx), 3, '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000002', (select inbox from ctx), 'Ler', '{"type": "daily"}',
   (select today - 1 from ctx), 0, '11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Primeira vez: começa a contar hoje, sem cobrar nada
select is((public.day_start_preview() ->> 'pending')::boolean, false, 'primeira virada não cobra');
select is((select hp_day from public.profiles where id = auth.uid()), (select today from ctx), 'começa a contar hoje');

reset role;
update public.profiles set hp_day = (select today - 1 from ctx) where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select is(jsonb_array_length(public.day_start_preview() -> 'items'), 2, '"o que você fez ontem?" lista as 2 diárias');
-- "Ler" foi feita ontem (só esqueceu de marcar): só "Alongar" (prioridade 3: 2 × 2 = 4) machuca
create temp table r1 as select public.day_start(array['d0000000-0000-0000-0000-000000000002'::uuid]) as r;
select is(((select r from r1) ->> 'damage')::integer, 4, 'diária perdida de prioridade alta tira 4 de vida');
select is((select hp from public.profiles where id = auth.uid()), 46, 'vida 50 → 46');
select is(((select r from r1) ->> 'applied')::boolean, true, 'a virada aplicou');
select is((public.day_start() ->> 'applied')::boolean, false, 'a mesma virada não cobra duas vezes');

-- Furtividade evita uma diária; escudo corta pela metade; taverna zera
reset role;
update public.profiles set hp_day = (select today - 1 from ctx), stealth = 1 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select is((public.day_start() ->> 'damage')::integer, 2, 'furtividade evita a de prioridade maior');
select is((select stealth from public.profiles where id = auth.uid()), 0, 'e é gasta');
reset role;
update public.profiles set hp_day = (select today - 1 from ctx), resting = true where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select is((public.day_start() ->> 'damage')::integer, 0, 'na taverna não perde vida');
update public.profiles set resting = false where id = auth.uid();

-- Morte: vida a zero
reset role;
update public.profiles set hp = 3, hp_day = (select today - 1 from ctx) where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select is((public.day_start() ->> 'dead')::boolean, true, 'vida zerada: morreu');
select is((public.day_start_preview() ->> 'pending')::boolean, false, 'morto não joga (nem leva dano)');
select throws_ok($$ select public.revive(true) $$, '22023', null, 'sem 500 de ouro não compra vida');

-- Com ouro: compra a vida e mantém tudo
reset role;
insert into public.xp_events (user_id, kind, amount, gold, day, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'task', 500, 600, (select today from ctx), now() - interval '1 hour');
insert into public.user_items (user_id, item_key, source) values ('11111111-1111-1111-1111-111111111111', 'cap', 'drop');
set local role authenticated;
select public.revive(true);
select is((select hp from public.profiles where id = auth.uid()), 50, 'comprou a vida: vida cheia');
select is((public.game_state() ->> 'gold')::integer, 100, '600 − 500 de ouro');
select ok((public.game_state() ->> 'level')::integer > 1, 'manteve o nível');
select is((select count(*)::int from public.user_items where user_id = auth.uid()), 1, 'e os itens');

-- Morrer de novo e recomeçar: perde tudo e volta ao nível 1
reset role;
update public.profiles set dead = true where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select public.revive(false);
select is((public.game_state() ->> 'level')::integer, 1, 'recomeçou no nível 1');
select is((public.game_state() ->> 'xp')::integer, 0, 'sem XP');
select is((public.game_state() ->> 'gold')::integer, 0, 'sem ouro');
select is((select count(*)::int from public.user_items where user_id = auth.uid()), 0, 'sem itens');
select is((public.game_state() ->> 'dead')::boolean, false, 'vivo de novo');

-- Recompensas (HB7) e baú
reset role;
insert into public.xp_events (user_id, kind, amount, gold, day, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'task', 0, 300, (select today from ctx), clock_timestamp());
set local role authenticated;
insert into public.user_rewards (title, cost) values ('Um episódio', 30);
select public.redeem_reward((select id from public.user_rewards where title = 'Um episódio'));
select is((public.game_state() ->> 'gold')::integer, 270, 'resgatar desconta o preço');
select ok((public.open_armoire() ->> 'gold')::integer = 170, 'baú custa 100');

-- Mascotes (HB8): chocar e alimentar até virar montaria
reset role;
insert into public.user_stacks (user_id, kind, key, qty) values
  ('11111111-1111-1111-1111-111111111111', 'egg', 'lobo', 1),
  ('11111111-1111-1111-1111-111111111111', 'potion', 'gelo', 1),
  ('11111111-1111-1111-1111-111111111111', 'food', 'peixe', 10),
  ('11111111-1111-1111-1111-111111111111', 'scroll', 'rei-esqueleto', 1);
set local role authenticated;
select public.hatch_pet('lobo', 'gelo');
select is((select count(*)::int from public.user_pets where user_id = auth.uid()), 1, 'ovo + poção = mascote');
select is((select count(*)::int from public.user_stacks where user_id = auth.uid() and kind in ('egg', 'potion')), 0,
  'ovo e poção são gastos');
select is((public.feed_pet('lobo', 'gelo', 'peixe') ->> 'fed')::integer, 5, 'comida favorita dá +5');
create temp table feeds as
select g, public.feed_pet('lobo', 'gelo', 'peixe') as r from generate_series(1, 9) g;
select is((select (r ->> 'mount')::boolean from feeds where g = 9), true, 'com 50 vira montaria');
select is((select count(*)::int from public.user_mounts where user_id = auth.uid()), 1, 'montaria no estábulo');

-- Missão (HB9): o pergaminho começa um boss que recebe os golpes
select is((public.start_quest('rei-esqueleto') ->> 'name'), 'Rei Esqueleto', 'pergaminho começa a missão');
select is(jsonb_array_length(public.game_state() -> 'quests'), 1, 'a missão aparece no estado do jogo');
select throws_ok($$ select public.cast_mana_skill('investida') $$, 'P0002', null, 'habilidade de outra classe não existe');

-- Estranho não vê nada disso
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.user_rewards) + (select count(*)::int from public.user_pets)
          + (select count(*)::int from public.user_mounts) + (select count(*)::int from public.gold_spends), 0,
  'estranho não vê recompensas, mascotes nem gastos');
select throws_ok($$ select public.redeem_reward((select id from public.user_rewards limit 1)) $$, 'P0002', null,
  'nem resgata a recompensa dos outros');
select is((public.day_start_preview() ->> 'pending')::boolean, false, 'no Leve, a virada não cobra nada');

select * from finish();
rollback;
