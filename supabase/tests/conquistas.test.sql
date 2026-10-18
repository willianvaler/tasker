-- V4 §2 (P1 a P3, D180): conquistas com raridade, % de jogadores, séries e secretas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

-- Toda conquista tem raridade e categoria; as de faixa têm série e meta juntas
select is((select count(*)::int from public.achievements where rarity is null or category is null), 0,
  'toda conquista tem raridade e categoria');
select is((select rarity from public.achievements where key = 'tasks_1000'), 'rare', 'mil tarefas é rara');
select is((select series || ':' || goal from public.achievements where key = 'streak_30'), 'streak:30',
  'sequência de 30 é a série streak com meta 30');

-- Só os dados deste teste (o banco de desenvolvimento tem outros jogadores)
truncate public.xp_events, public.user_achievements cascade;

-- Ana concluiu tarefas (ledger) e tem a primeira conquista; Bia jogou mas não tem
insert into public.xp_events (user_id, kind, amount, day) values
  ('11111111-1111-1111-1111-111111111111', 'task', 10, current_date),
  ('11111111-1111-1111-1111-111111111111', 'task', 10, current_date),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, current_date);
insert into public.user_achievements (user_id, achievement_key) values
  ('11111111-1111-1111-1111-111111111111', 'first_task');
select public.refresh_achievement_stats();
select is((select holders || '/' || players from public.achievement_stats where achievement_key = 'first_task'),
  '1/2', 'estatística: 1 de 2 jogadores tem a primeira tarefa');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table mine as select public.my_achievements() as r;
select is((select (r #>> '{progress,tasks}')::int from mine), 2, 'progresso: 2 tarefas no ledger');
select ok((select (x ->> 'unlocked_at') is not null from mine, jsonb_array_elements(r -> 'items') x
           where x ->> 'key' = 'first_task'), 'a conquista dela vem com a data');
select is((select (x ->> 'pct')::numeric from mine, jsonb_array_elements(r -> 'items') x
           where x ->> 'key' = 'first_task'), 50.0, 'e com a % de jogadores');
select is((select x ->> 'rarity' from mine, jsonb_array_elements(r -> 'items') x
           where x ->> 'key' = 'tasks_100'), 'uncommon', 'e com a raridade');

-- Ninguém escreve nas estatísticas nem recalcula
select throws_ok($$update public.achievement_stats set holders = 999$$, '42501', null,
  'usuário não altera as estatísticas');
select throws_ok($$select public.refresh_achievement_stats()$$, '42501', null,
  'nem roda o cálculo');
reset role;

-- Secreta não conquistada: sem ícone na resposta
update public.achievements set secret = true where key = 'night_owl';
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select x ->> 'icon' from jsonb_array_elements(public.my_achievements() -> 'items') x
           where x ->> 'key' = 'night_owl'), null, 'secreta bloqueada não mostra o ícone');
reset role;

-- P2: catálogo com 68 e concessão pelas séries e pelas especiais
reset role;
select is((select count(*)::int from public.achievements), 68, 'catálogo com 68 conquistas');
select is((select count(*)::int from public.achievements where secret and key <> 'night_owl'), 4,
  '4 secretas (a night_owl virou secreta só neste teste)');
-- Bia: 50 tarefas hoje (maratona) e a primeira há 40 dias (de volta depois de 30 parada)
insert into public.xp_events (user_id, kind, amount, day, created_at)
select '22222222-2222-2222-2222-222222222222', 'task', 1, current_date, now() from generate_series(1, 50);
insert into public.xp_events (user_id, kind, amount, day, created_at) values
  ('22222222-2222-2222-2222-222222222222', 'task', 1, current_date - 40, now() - interval '40 days');
create temp table got as select public._check_achievements('22222222-2222-2222-2222-222222222222') as r;
select ok(exists (select 1 from public.user_achievements where user_id = '22222222-2222-2222-2222-222222222222'
                  and achievement_key = 'tasks_10'), 'faixa: 52 tarefas dão a de 10');
select ok(not exists (select 1 from public.user_achievements where user_id = '22222222-2222-2222-2222-222222222222'
                      and achievement_key = 'tasks_100'), 'e não a de 100');
select ok(exists (select 1 from public.user_achievements where user_id = '22222222-2222-2222-2222-222222222222'
                  and achievement_key = 'fifty_day'), 'secreta: 50 tarefas num dia');
select ok(exists (select 1 from public.user_achievements where user_id = '22222222-2222-2222-2222-222222222222'
                  and achievement_key = 'comeback'), 'secreta: voltou depois de 30 dias');

-- Sem login, nada
set local request.jwt.claims = '{"role": "anon"}';
set local role anon;
select throws_ok($$select public.my_achievements()$$, '42501', null, 'anônimo não vê conquistas');

select * from finish();
rollback;
