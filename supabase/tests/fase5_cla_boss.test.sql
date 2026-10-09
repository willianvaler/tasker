-- Fase 5: clã, boss de clã e de projeto, quadro de contribuição, exportar e excluir conta.
-- Rode com: npx supabase test db. now() é fixo na transação: o created_at das tarefas é recuado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{"display_name": "Bia"}'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local', '{"display_name": "Caio"}'),
  ('44444444-4444-4444-4444-444444444444', 'duda@teste.local', '{"display_name": "Duda"}');

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated, anon;

-- ---------- Ana cria o clã ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into ids values ('clan', public.create_clan('Guilda', '🛡️'));
select is(public.my_clan()::text, (select v from ids where k = 'clan'), 'quem cria o clã entra nele');
select is((select role from public.clan_members where user_id = auth.uid()), 'owner', 'como dona');
select throws_ok($$ select public.create_clan('Outro') $$, '22023', null, 'um clã por pessoa');
insert into ids values ('token', public.create_clan_invite());
select is(public.create_clan_invite(), (select v from ids where k = 'token'), 'o mesmo link enquanto vale');

-- Pasta, página e tarefas da Ana (projeto, para o boss de projeto)
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco');
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pessoal');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lista'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Minhas');
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carne'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Cerveja'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Carvão'),
  ('cccccccc-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000002', 'Ler'),
  ('cccccccc-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000002', 'Correr');
insert into ids values ('invite', (public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')).token);

-- ---------- Sem login: prévia ----------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.clan_invite_preview((select v from ids where k = 'token')) ->> 'name', 'Guilda', 'prévia do clã sem login');

-- ---------- Bia entra no clã e no projeto ----------
reset role;
update public.tasks set created_at = now() - interval '1 hour';
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.join_clan((select v from ids where k = 'token'))::text, (select v from ids where k = 'clan'), 'Bia entra no clã');
select is((select count(*)::int from public.clan_members), 2, 'vê os membros do clã');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 1,
  'vê o perfil da colega de clã');
select public.accept_invite((select v from ids where k = 'invite'));
insert into public.tasks (id, page_id, title) values ('cccccccc-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000001', 'Gelo');
insert into public.task_assignees (task_id, user_id) values ('cccccccc-0000-0000-0000-000000000021', auth.uid());
reset role;
update public.tasks set created_at = now() - interval '1 hour' where id = 'cccccccc-0000-0000-0000-000000000021';

-- ---------- Caio tem outro clã; Bia não entra em dois ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_clan('Outro');
insert into ids values ('token2', public.create_clan_invite());
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.join_clan((select v from ids where k = 'token2')) $$, '22023', null,
  'não entra em dois clãs');

-- ---------- Boss do clã: dano = XP dos membros ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select isnt(public.game_state() -> 'clan_boss', 'null'::jsonb, 'clã tem boss da semana');
select is(public.game_state() #>> '{clan,name}', 'Guilda', 'game_state mostra o clã');
select public.complete_task('cccccccc-0000-0000-0000-000000000011');
select is((select count(*)::int from public.boss_damage d join public.xp_events e on e.id = d.xp_event_id
           where e.task_id = 'cccccccc-0000-0000-0000-000000000011'), 2,
  'um XP bate no boss solo e no do clã');
insert into ids select 'clan_boss', id from public.bosses
  where scope = 'clan' and scope_id = (select v::uuid from ids where k = 'clan');
select is((select max_hp - hp from public.bosses where id = (select v::uuid from ids where k = 'clan_boss')), 10,
  'boss do clã tomou 10');

-- Deixa o boss do clã a 5 HP do fim
reset role;
update public.bosses set max_hp = (select sum(amount) from public.boss_damage where boss_id = bosses.id) + 5,
  hp = 5 where id = (select v::uuid from ids where k = 'clan_boss');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((public.complete_task('cccccccc-0000-0000-0000-000000000021') ->> 'boss_defeated')::boolean, true,
  'Bia dá o golpe final no boss do clã');
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted
           and boss_id = (select v::uuid from ids where k = 'clan_boss')), 1,
  'Bia vê a recompensa dela');
reset role;
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted
           and boss_id = (select v::uuid from ids where k = 'clan_boss')), 2,
  'todos que contribuíram ganham (Ana e Bia)');
select is((select xp from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 60,
  'o XP da Ana (que não fez nada agora) já conta a recompensa');
select is((select count(*)::int from public.clan_activity where action = 'boss_defeated'
           and clan_id = (select v::uuid from ids where k = 'clan')), 1, 'derrota no feed do clã');
select ok(exists (select 1 from public.clan_activity where action = 'achievement'
                  and clan_id = (select v::uuid from ids where k = 'clan')), 'conquistas no feed do clã');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(jsonb_array_length(public.boss_board((select v::uuid from ids where k = 'clan_boss'))), 2,
  'quadro de contribuição do clã');

select public.uncomplete_task('cccccccc-0000-0000-0000-000000000021');
reset role;
select is((select status from public.bosses where id = (select v::uuid from ids where k = 'clan_boss')),
  'active', 'desmarcar o golpe final revive o boss do clã');
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted
           and boss_id = (select v::uuid from ids where k = 'clan_boss')), 0, 'e a recompensa sai de todos');
select is((select xp from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 10, 'XP da Ana volta');
select is((select count(*)::int from public.clan_activity where action = 'boss_defeated'
           and clan_id = (select v::uuid from ids where k = 'clan')), 0, 'e some do feed');

-- ---------- Boss de projeto ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.start_project_boss('aaaaaaaa-0000-0000-0000-000000000002', current_date + 3) $$,
  '22023', null, 'pasta pessoal não tem boss de projeto');
select throws_ok($$ select public.start_project_boss('aaaaaaaa-0000-0000-0000-000000000001', current_date - 3) $$,
  '22023', null, 'prazo no passado não vale');
insert into ids select 'project_boss', id from public.start_project_boss('aaaaaaaa-0000-0000-0000-000000000001', current_date + 3);
select is((select max_hp || ':' || hp from public.bosses where id = (select v::uuid from ids where k = 'project_boss')), '4:4',
  'HP = tarefas principais do projeto');
select throws_ok($$ select public.start_project_boss('aaaaaaaa-0000-0000-0000-000000000001', current_date + 5) $$,
  '22023', null, 'um boss por vez');
select ok(exists (select 1 from public.activity_log where action = 'boss_started'), 'boss aparece na atividade');

select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select public.complete_task('cccccccc-0000-0000-0000-000000000002');
select public.complete_task('cccccccc-0000-0000-0000-000000000003');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select hp from public.bosses where id = (select v::uuid from ids where k = 'project_boss')), 1, 'cada tarefa é 1 de dano');
select public.complete_task('cccccccc-0000-0000-0000-000000000021');
select is((select status from public.bosses where id = (select v::uuid from ids where k = 'project_boss')), 'defeated',
  'última tarefa derrota o boss do projeto');
select is(public.boss_board((select v::uuid from ids where k = 'project_boss')) -> 0 ->> 'name', 'Ana',
  'quadro: quem concluiu mais primeiro');
reset role;
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted
           and boss_id = (select v::uuid from ids where k = 'project_boss')), 2, 'recompensa para quem concluiu');
select ok(exists (select 1 from public.user_achievements where user_id = '11111111-1111-1111-1111-111111111111'
                  and achievement_key = 'project_done'), 'conquista: missão cumprida');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.tasks (page_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Farofa');
select is((select status || ':' || hp || '/' || max_hp from public.bosses where id = (select v::uuid from ids where k = 'project_boss')),
  'active:1/5', 'tarefa nova no projeto: o boss volta com 1 HP');
reset role;
select is((select count(*)::int from public.xp_events where kind = 'boss_reward' and not reverted
           and boss_id = (select v::uuid from ids where k = 'project_boss')), 0, 'e a recompensa sai');

-- ---------- Estranho não vê ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.clans) + (select count(*)::int from public.clan_members)
          + (select count(*)::int from public.clan_activity) + (select count(*)::int from public.bosses where scope <> 'user'), 0,
  'estranho não vê clã, membros, feed nem bosses dos outros');
select throws_ok($$ select public.boss_board((select v::uuid from ids where k = 'project_boss')) $$, 'P0002', null,
  'nem o quadro');
select throws_ok($$ insert into public.clan_members (clan_id, user_id) values ((select v::uuid from ids where k = 'clan'), auth.uid()) $$,
  '42501', null, 'não entra no clã sem convite');

-- ---------- Sair do clã ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.leave_clan();
reset role;
select is((select role from public.clan_members where user_id = '22222222-2222-2222-2222-222222222222'), 'owner',
  'dona saiu: o clã passa para quem ficou');

-- ---------- Exportar e excluir conta ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(jsonb_array_length(public.export_my_data() -> 'tasks'), 7, 'exportação traz as tarefas');
select ok(jsonb_array_length(public.export_my_data() -> 'xp_events') > 0, 'e o histórico de XP');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.delete_my_account();
reset role;
select is((select count(*)::int from auth.users where id = '22222222-2222-2222-2222-222222222222'), 0, 'conta excluída');
select is((select created_by::text from public.tasks where id = 'cccccccc-0000-0000-0000-000000000021'),
  '11111111-1111-1111-1111-111111111111', 'tarefa que ela criou no projeto da Ana fica, com a Ana');
select is((select pending_name from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000021'), 'Bia',
  'e o que era dela volta a ser nome pendente');

select * from finish();
rollback;
