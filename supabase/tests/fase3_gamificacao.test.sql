-- Fase 3: XP com ledger e anti-farm, níveis, sequência, boss e conquistas. Rode com: npx supabase test db
-- Atenção: now() é fixo dentro da transação. Para a tarefa não contar como "relâmpago", o teste
-- recua o created_at (como superusuário).
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

-- ---------- Funções puras (os mesmos casos de src/lib/__tests__/gamification.test.ts) ----------
select is(public.xp_to_next(1), 100, 'nível 1 → 2: 100 XP');
select is(public.xp_to_next(2), 264, 'nível 2 → 3: round(100 * 2^1.4)');
select is(public.xp_to_next(10), 2512, 'nível 10 → 11');
select is((public.level_for_xp(0)).level, 1, '0 XP: nível 1');
select is((public.level_for_xp(99)).level, 1, '99 XP: nível 1');
select is((public.level_for_xp(100)).level, 2, '100 XP: nível 2');
select is((public.level_for_xp(363)).into_level, 263, '363 XP: 263 dentro do nível 2');
select is((public.level_for_xp(364)).level, 3, '364 XP: nível 3');

-- ---------- Usuários ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

-- Sequência com congelamento (datas fixas; 04/10/2026 é domingo, fim da semana ISO 40)
insert into public.xp_events (user_id, kind, amount, day) values
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-01'),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-02'),
  ('22222222-2222-2222-2222-222222222222', 'too_fast', 0, '2026-10-03'),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-05'),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-12'),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-14'),
  ('22222222-2222-2222-2222-222222222222', 'task', 10, '2026-10-16'),
  ('22222222-2222-2222-2222-222222222222', 'page_bonus', 25, '2026-10-17');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-05')).current_streak, 4,
  'domingo sem nada é coberto pelo congelamento (o dia não conta, mas não quebra)');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-06')).current_streak, 4,
  'hoje sem atividade ainda não quebra');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-07')).current_streak, 4,
  'ontem sem nada: congelamento da semana segura enquanto hoje não acaba');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-08')).current_streak, 0,
  'dois dias sem nada quebram');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-16')).current_streak, 1,
  'só um congelamento por semana: o segundo buraco na mesma semana quebra');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-16')).best_streak, 4, 'melhor sequência');
select is((public.streak_stats('22222222-2222-2222-2222-222222222222', '2026-10-17')).current_streak, 1,
  'bônus de página não conta como dia ativo');
delete from public.xp_events where user_id = '22222222-2222-2222-2222-222222222222';

-- ---------- Como Ana ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contas', 'list', 'none'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino', 'cards', 'weekly'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rotina', 'cards', 'manual');
insert into public.tasks (id, page_id, title, priority, recurrence) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pagar luz', 0, null),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Imposto', 3, null),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Recém-criada', 0, null),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'Remédio', 0, '{"type": "daily"}'),
  ('cccccccc-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000002', 'Supino', 0, null),
  ('cccccccc-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000002', 'Remada', 0, null),
  ('cccccccc-0000-0000-0000-000000000013', 'bbbbbbbb-0000-0000-0000-000000000002', 'Agachamento', 0, null),
  ('cccccccc-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000003', 'Alongar', 0, null);

reset role;
update public.tasks set created_at = now() - interval '1 hour' where id <> 'cccccccc-0000-0000-0000-000000000003';
update public.pages set created_at = now() - interval '1 hour';
set local role authenticated;

-- Conceder e reverter
select is((public.complete_task('cccccccc-0000-0000-0000-000000000001') ->> 'xp')::int, 10, 'tarefa comum: 10 XP');
select is((select xp from public.profiles where id = auth.uid()), 10, 'perfil soma o ledger');
select is((public.uncomplete_task('cccccccc-0000-0000-0000-000000000001') ->> 'xp')::int, -10, 'desmarcar devolve o que ganhou');
select is((select xp from public.profiles where id = auth.uid()), 0, 'perfil volta a 0');
select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000001');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000001') ->> 'xp')::int, 10, 'marcar de novo concede de novo');
select is((select xp from public.profiles where id = auth.uid()), 10, 'marcar/desmarcar várias vezes = uma conclusão');
select is((select count(*)::int from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000001' and not reverted), 1,
  'um só evento valendo por tarefa e ciclo');

select is((public.complete_task('cccccccc-0000-0000-0000-000000000002') ->> 'xp')::int, 15, 'prioridade alta: ×1,5');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000003') ->> 'xp')::int, 0, 'relâmpago: 0 XP');
select is((select kind from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000003'), 'too_fast',
  'relâmpago fica registrado como too_fast');

-- Recorrente comum: um XP por dia, mesmo avançando a data mais de uma vez
select ok((public.complete_task('cccccccc-0000-0000-0000-000000000004') ->> 'xp')::int >= 8, 'recorrente: 8 XP + sequência');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000004') ->> 'xp')::int, 0,
  'recorrente concluída de novo no mesmo dia: 0 XP');
select is((public.uncomplete_task('cccccccc-0000-0000-0000-000000000004') ->> 'xp')::int, 0,
  'desfazer a conclusão que não ganhou XP não tira nada');
select ok((public.uncomplete_task('cccccccc-0000-0000-0000-000000000004') ->> 'xp')::int <= -8,
  'desfazer a primeira devolve o XP dela');

-- Página de cards inteira
select is((public.complete_task('cccccccc-0000-0000-0000-000000000011') ->> 'xp')::int, 5, 'card: 5 XP');
select public.complete_task('cccccccc-0000-0000-0000-000000000012');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000013') ->> 'xp')::int, 30, 'último card: 5 + bônus de 25');
select is((public.uncomplete_task('cccccccc-0000-0000-0000-000000000012') ->> 'xp')::int, -30,
  'desmarcar um card tira o card e o bônus');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000012') ->> 'xp')::int, 30, 'remarcar devolve os dois');

-- Reset manual não gera XP de novo no mesmo dia
select is((public.complete_task('cccccccc-0000-0000-0000-000000000021') ->> 'xp')::int, 5, 'card de rotina manual: 5 XP');
select public.reset_page('bbbbbbbb-0000-0000-0000-000000000003');
select is((public.complete_task('cccccccc-0000-0000-0000-000000000021') ->> 'xp')::int, 0,
  'reiniciar na mão e marcar de novo no mesmo dia: 0 XP');

-- Teto diário do que foi concluído logo depois de criado (entre 30 s e 5 min)
insert into public.tasks (id, page_id, title)
select ('dddddddd-0000-0000-0000-00000000000' || i)::uuid, 'bbbbbbbb-0000-0000-0000-000000000001', 'Rápida ' || i
from generate_series(1, 6) i;
reset role;
update public.tasks set created_at = now() - interval '1 minute' where title like 'Rápida %';
set local role authenticated;
select public.complete_task(('dddddddd-0000-0000-0000-00000000000' || i)::uuid) from generate_series(1, 5) i;
select is((public.complete_task('dddddddd-0000-0000-0000-000000000006') ->> 'xp')::int, 0, 'teto diário de 50 XP para as rápidas');
select is((select sum(amount)::int from public.xp_events where quick and not reverted), 50, 'rápidas somam 50');

-- Lote com [x]: registra, mas não dá XP
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002', '[{"title": "Prancha", "done": true}]');
select is((select kind || ':' || amount from public.xp_events e join public.tasks t on t.id = e.task_id where t.title = 'Prancha'),
  'too_fast:0', '[x] do lote vira relâmpago, mesmo em cards');

-- Boss: dano = XP ganho
select is((select hp from public.bosses where scope_id = auth.uid()),
          (select greatest(0, b.max_hp - sum(d.amount))::int from public.bosses b join public.boss_damage d on d.boss_id = b.id
           where b.scope_id = auth.uid() group by b.max_hp), 'HP do boss = máximo − dano (sem passar de 0)');
select is((select sum(amount)::int from public.boss_damage where user_id = auth.uid()),
          (select sum(amount)::int from public.xp_events where user_id = auth.uid() and not reverted and kind <> 'boss_reward'),
          'dano = XP ganho (e o revertido saiu)');

reset role;
-- Um boss novo, a 5 HP do fim
update public.bosses
set max_hp = (select sum(amount) from public.boss_damage where user_id = '11111111-1111-1111-1111-111111111111') + 5,
    hp = 5, status = 'active', defeated_at = null
where scope_id = '11111111-1111-1111-1111-111111111111';
update public.xp_events set reverted = true
where kind = 'boss_reward' and user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
insert into public.tasks (id, page_id, title) values ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'Golpe final');
reset role;
update public.tasks set created_at = now() - interval '1 hour' where id = 'cccccccc-0000-0000-0000-000000000005';
set local role authenticated;
select is((public.complete_task('cccccccc-0000-0000-0000-000000000005') ->> 'boss_defeated')::boolean, true, 'golpe final derrota o boss');
select is((select status from public.bosses where scope_id = auth.uid()), 'defeated', 'boss derrotado');
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted), 1, 'recompensa no ledger');
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000005');
select is((select status || ':' || hp from public.bosses where scope_id = auth.uid()), 'active:5', 'desmarcar o golpe final revive o boss');
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted), 0, 'e a recompensa sai');

-- Conquistas e estado
select ok(exists (select 1 from public.user_achievements where achievement_key = 'first_task'), 'conquista: primeira tarefa');
select ok(exists (select 1 from public.user_achievements where achievement_key = 'page_complete'), 'conquista: página inteira');
select is((public.game_state() ->> 'xp')::int, (select sum(amount)::int from public.xp_events where not reverted),
  'game_state mostra o XP do ledger');

-- ---------- Permissões ----------
select throws_ok($$ insert into public.xp_events (user_id, kind, amount, day) values (auth.uid(), 'task', 999, current_date) $$,
  '42501', null, 'cliente não grava no ledger');
select throws_ok($$ update public.profiles set xp = 99999 where id = auth.uid() $$, '42501', null, 'cliente não muda o XP do perfil');
select throws_ok($$ select public._grant_xp(auth.uid(), 'task', 999, false, null, null, null, 'x') $$,
  '42501', null, 'cliente não chama as funções internas');

-- Bia não vê nada da Ana e, como leitora da pasta, não conclui
reset role;
insert into public.folder_members (folder_id, user_id, role)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.xp_events) + (select count(*)::int from public.bosses)
          + (select count(*)::int from public.boss_damage) + (select count(*)::int from public.user_achievements), 0,
  'estranho não vê ledger, boss nem conquistas dos outros');
select throws_ok($$ select public.complete_task('cccccccc-0000-0000-0000-000000000001') $$,
  'P0002', null, 'leitora não conclui (nem ganha XP)');

select * from finish();
rollback;
