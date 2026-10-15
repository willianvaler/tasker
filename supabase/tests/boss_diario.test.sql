-- V4 §1.1 (O1): boss diário.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Funções puras (os mesmos casos de src/lib/__tests__/gamification.test.ts)
select is(public.daily_boss_hp(1), 60, 'diário nível 1: 60 HP');
select is(public.daily_boss_hp(2), 63, 'diário nível 2: round(60 × 1,05)');
select is(public.daily_boss_hp(100), 180, 'diário nunca passa de 3 × a base');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contas', 'none');
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pagar luz'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Golpe final');
reset role;
update public.tasks set created_at = now() - interval '1 hour';
set local role authenticated;

select is((public.game_state() #>> '{daily_boss,max_hp}')::int, 60, 'o diário nasce com 60 HP');
select is(public.game_state() #>> '{daily_boss,scope}', 'daily', 'e é do tipo diário');
select is((public.game_state() ->> 'daily_streak')::int, 0, 'nenhum dia seguido ainda');

select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select ok((public.game_state() #>> '{daily_boss,hp}')::int < 60, 'o golpe tira do diário');
select ok((public.game_state() #>> '{boss,hp}')::int < (public.game_state() #>> '{boss,max_hp}')::int,
  'e do semanal ao mesmo tempo');

-- O golpe final derruba o diário: recompensa menor que a do semanal
reset role;
update public.bosses set max_hp = (select coalesce(sum(amount), 0) + 1 from public.boss_damage d where d.boss_id = bosses.id)
where scope = 'daily';
set local role authenticated;
select public.complete_task('cccccccc-0000-0000-0000-000000000002');
select is(public.game_state() #>> '{daily_boss,status}', 'defeated', 'diário derrotado');
select is((select e.amount from public.xp_events e join public.bosses b on b.id = e.boss_id
           where b.scope = 'daily' and e.kind = 'boss_reward'), 15, 'recompensa do diário: 15 XP');
select is((public.game_state() ->> 'daily_streak')::int, 1, 'um dia seguido');
select is((public.game_state() ->> 'daily_defeated')::int, 1, 'um diário derrotado');
select is((public.game_state() ->> 'bosses_defeated')::int, 0, 'o diário não conta como boss semanal');

-- Outra pessoa não vê o diário de ninguém
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.bosses where scope = 'daily'
           and scope_id = '11111111-1111-1111-1111-111111111111'), 0, 'estranho não vê o diário');

select * from finish();
rollback;
