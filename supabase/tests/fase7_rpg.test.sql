-- Fase 7: classe, atributos, dano, ouro, loja, drops, níveis de boss, hábitos contador e bom/ruim.
-- Rode com: npx supabase test db. now() é fixo na transação: recue o created_at como superusuário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- ---------- Funções puras (os mesmos casos de src/lib/__tests__/gamification.test.ts) ----------
select is(public.boss_hp_for_level(1), 120, 'boss nível 1: 120 HP');
select is(public.boss_hp_for_level(2), 144, 'boss nível 2: 120 × 1,2');
select is(public.boss_hp_for_level(5), 249, 'boss nível 5: round(120 × 1,2^4)');

-- ---------- Usuários ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contas', 'list', 'none'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hábitos', 'habits', 'none');
insert into public.tasks (id, page_id, title, habit_kind, habit_target) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pagar luz', 'check', null),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Recém-criada', 'check', null),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Golpe final', 'check', null),
  ('cccccccc-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000002', 'Beber água', 'counter', 3),
  ('cccccccc-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000002', 'Comer bem', 'plusminus', null);

reset role;
update public.tasks set created_at = now() - interval '1 hour' where id <> 'cccccccc-0000-0000-0000-000000000002';
set local role authenticated;

-- ---------- Atributos e classe ----------
select is(public.game_state() -> 'attributes', '{"str": 1, "agi": 1, "int": 1, "con": 1}'::jsonb,
  'sem classe: todos os atributos em 1');
select is(public.game_state() -> 'class', 'null'::jsonb, 'começa sem classe');
select throws_ok($$ select public.use_skill() $$, '22023', null, 'sem classe não há habilidade');
select throws_ok($$ select public.set_class('dragao') $$, '22023', null, 'classe desconhecida');
select public.set_class('lutador');
select is(public.game_state() -> 'attributes', '{"str": 4, "agi": 1, "int": 1, "con": 2}'::jsonb,
  'lutador: +3 Força, +1 Constituição');
select ok(exists (select 1 from public.user_achievements where achievement_key = 'class_chosen'), 'conquista: escolher classe');
select is(public.game_state() -> 'skill_active', 'false'::jsonb, 'habilidade ainda não usada: false (não null)');
select throws_ok($$ select public.allocate_attribute('str') $$, '22023', null, 'nível 1: sem pontos');
select throws_ok($$ update public.profiles set class = 'mago', attr_str = 50 where id = auth.uid() $$, '42501', null,
  'cliente não muda classe nem atributos direto');

-- ---------- Dano ----------
-- Lutador: o primeiro golpe do dia dobra. 4 × (1 + 0,05 × 4) × 2 = 9,6 → 10 (ou 19 num crítico)
select ok((public.complete_task('cccccccc-0000-0000-0000-000000000001') ->> 'damage')::int in (10, 19),
  'tarefa comum: 4 × Força × primeiro golpe do lutador');
select is((select gold from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000001'), 2,
  'ouro da tarefa: 2 × (1 + 0,03 × 2) = 2');
select is((select sum(amount)::int from public.boss_damage d join public.bosses b on b.id = d.boss_id where b.scope = 'user'),
          (select sum(damage)::int from public.xp_events where not reverted), 'o dano do evento bateu no boss solo');

-- Relâmpago: 0 XP, mas bate no boss (D60)
select is((public.complete_task('cccccccc-0000-0000-0000-000000000002') ->> 'xp')::int, 0, 'relâmpago: 0 XP');
select ok((select damage from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000002') > 0,
  'relâmpago: o golpe vale');
select is((select gold from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000002'), 0, 'relâmpago: 0 ouro');

-- Teto diário do dano rápido
insert into public.tasks (id, page_id, title)
select ('dddddddd-0000-0000-0000-00000000000' || i)::uuid, 'bbbbbbbb-0000-0000-0000-000000000001', 'Rápida ' || i
from generate_series(1, 8) i;
reset role;
update public.tasks set created_at = now() - interval '1 minute' where title like 'Rápida %';
set local role authenticated;
select public.complete_task(('dddddddd-0000-0000-0000-00000000000' || i)::uuid) from generate_series(1, 8) i;
select ok((select sum(damage)::int from public.xp_events where quick and not reverted) <= 20,
  'conclusões rápidas somam no máximo 20 de dano por dia');

-- Lote com [x]: nem XP nem dano
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001', '[{"title": "Feita antes", "done": true}]');
select is((select damage from public.xp_events e join public.tasks t on t.id = e.task_id where t.title = 'Feita antes'), 0,
  '[x] do lote não bate no boss');

-- ---------- Hábito contador ----------
select public.habit_tick('cccccccc-0000-0000-0000-000000000011', 1);
select is((public.habit_tick('cccccccc-0000-0000-0000-000000000011', 1) #>> '{task,count_up}')::int, 2, 'contador: 2/3');
select is((select status::text from public.tasks where id = 'cccccccc-0000-0000-0000-000000000011'), 'todo',
  'abaixo da meta continua aberto');
select ok((public.habit_tick('cccccccc-0000-0000-0000-000000000011', 1) ->> 'xp')::int >= 8, 'bater a meta conclui (XP de hábito)');
select is((select status::text from public.tasks where id = 'cccccccc-0000-0000-0000-000000000011'), 'done', 'meta batida: feito');
select is((public.habit_tick('cccccccc-0000-0000-0000-000000000011', 1) #>> '{task,count_up}')::int, 3, 'não passa da meta');
select ok(exists (select 1 from public.user_achievements where achievement_key = 'counter_goal'), 'conquista: meta batida');
select ok((public.habit_tick('cccccccc-0000-0000-0000-000000000011', -1) ->> 'xp')::int <= -8, '− abaixo da meta desfaz');
select is((select status::text || ':' || count_up from public.tasks where id = 'cccccccc-0000-0000-0000-000000000011'),
  'todo:2', 'volta para 2/3, aberto');
select throws_ok($$ select public.habit_tick('cccccccc-0000-0000-0000-000000000001', 1) $$, '22023', null,
  'hábito de marcar não tem + e −');

-- ---------- Hábito bom/ruim ----------
select is((public.habit_tick('cccccccc-0000-0000-0000-000000000012', 1, 'eeeeeeee-0000-0000-0000-000000000001') ->> 'xp')::int, 3,
  'hábito bom: 3 XP');
select is((public.habit_tick('cccccccc-0000-0000-0000-000000000012', 1, 'eeeeeeee-0000-0000-0000-000000000001') ->> 'event_id'),
  'eeeeeeee-0000-0000-0000-000000000001', 'reenviar o mesmo id não conta de novo');
select is((select count_up from public.tasks where id = 'cccccccc-0000-0000-0000-000000000012'), 1, 'um + só');
select public.habit_tick('cccccccc-0000-0000-0000-000000000012', 1) from generate_series(1, 11);
select is((select count(*)::int from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000012'
           and kind = 'habit_plus' and amount > 0 and not reverted), 10, 'hábito bom: XP só nos 10 primeiros do dia');
select is((select count_up from public.tasks where id = 'cccccccc-0000-0000-0000-000000000012'), 12, 'mas todos são contados');

-- Hábito ruim cura o boss (só o que ele já apanhou)
reset role;
update public.bosses set max_hp = 500, hp = 500 - (select sum(amount) from public.boss_damage where boss_id = bosses.id)
where scope = 'user' and scope_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
create temp table hp_before as select hp from public.bosses where scope = 'user';
select ok((public.habit_tick('cccccccc-0000-0000-0000-000000000012', -1, 'eeeeeeee-0000-0000-0000-000000000002') ->> 'heal')::int > 0,
  'hábito ruim cura o boss');
select ok((select hp from public.bosses where scope = 'user') > (select hp from hp_before), 'HP subiu');
select is((select count_down from public.tasks where id = 'cccccccc-0000-0000-0000-000000000012'), 1, 'um − contado');
select public.undo_habit_tick('eeeeeeee-0000-0000-0000-000000000002');
select is((select hp from public.bosses where scope = 'user'), (select hp from hp_before), 'desfazer o − tira a cura');
select is((select count_down from public.tasks where id = 'cccccccc-0000-0000-0000-000000000012'), 0, 'e a contagem');

-- Virada do período zera as contagens
reset role;
update public.tasks set count_key = '2020-01-01' where id = 'cccccccc-0000-0000-0000-000000000012';
set local role authenticated;
select public.refresh_cycles();
select is((select count_up || ':' || count_down from public.tasks where id = 'cccccccc-0000-0000-0000-000000000012'), '0:0',
  'período novo: contagens zeradas');

-- ---------- Ouro e loja ----------
select throws_ok($$ select public.buy_item('tophat') $$, '22023', null, 'ouro insuficiente');
reset role;
insert into public.xp_events (user_id, kind, amount, gold, day)
values ('11111111-1111-1111-1111-111111111111', 'page_bonus', 0, 200, current_date);
set local role authenticated;
create temp table gold_before as select (public.game_state() ->> 'gold')::int as g;
select is((public.buy_item('cap') ->> 'gold')::int, (select g from gold_before) - 40, 'comprar desconta o preço');
select throws_ok($$ select public.buy_item('cap') $$, '22023', null, 'não compra o mesmo item duas vezes');
select throws_ok($$ select public.buy_item('crown') $$, '22023', null, 'item de boss não está à venda');
select ok(exists (select 1 from public.user_achievements where achievement_key = 'first_purchase'), 'conquista: primeira compra');
select lives_ok($$ select public.equip_item('head', 'cap') $$, 'equipa o boné');
select is(public.game_state() #>> '{equipped,head}', 'cap', 'boné equipado');
select throws_ok($$ select public.equip_item('pet', 'cap') $$, 'P0002', null, 'boné não vai no espaço de companheiro');
select throws_ok($$ select public.equip_item('head', 'tophat') $$, 'P0002', null, 'não equipa o que não tem');
select throws_ok($$ insert into public.user_items (user_id, item_key, source) values (auth.uid(), 'crown', 'drop') $$,
  '42501', null, 'cliente não se dá itens');

-- ---------- Boss: nível, recompensa com ouro e drop ----------
reset role;
update public.bosses set max_hp = (select sum(amount) from public.boss_damage where boss_id = bosses.id) + 1, hp = 1
where scope = 'user' and scope_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
create temp table defeat as select public.complete_task('cccccccc-0000-0000-0000-000000000003') as r;
select is(((select r from defeat) ->> 'boss_defeated')::boolean, true, 'golpe final derrota o boss');
select is(jsonb_array_length((select r from defeat) -> 'drops'), 1, 'o boss deixa cair um item');
select is((select gold from public.xp_events where kind = 'boss_reward' and not reverted), 20, 'recompensa: 20 de ouro no nível 1');
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.user_items where source = 'drop'), 0, 'boss revivido: o item sai junto');

-- ---------- Habilidade ----------
select lives_ok($$ select public.use_skill() $$, 'usa a habilidade');
select throws_ok($$ select public.use_skill() $$, '22023', null, 'uma vez por dia');
select is((public.game_state() ->> 'skill_active')::boolean, true, 'ativa até o fim do dia');

-- ---------- Estranha e leitora ----------
reset role;
insert into public.folder_members (folder_id, user_id, role)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.user_items), 0, 'não vê os itens dos outros');
select ok((select count(*)::int from public.items) > 30, 'catálogo da loja é público');
select throws_ok($$ select public.habit_tick('cccccccc-0000-0000-0000-000000000012', 1) $$, 'P0002', null,
  'leitora não registra hábito');

select * from finish();
rollback;
