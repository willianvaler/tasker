-- D186: grupos de treino. Pasta raiz compartilhável (projeto com gym_group), páginas de treino.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok($$ insert into public.folders (id, name, kind, gym_group)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Treino com a Bia', 'project', true) $$,
  'dono cria o grupo de treino');
select throws_ok($$ insert into public.folders (id, name, kind, gym_group)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'Solta', 'folder', true) $$, '23514', null,
  'grupo é sempre projeto');
select throws_ok($$ insert into public.folders (id, parent_id, name, kind, gym_group)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Sub', 'project', true) $$,
  '23514', null, 'grupo só na raiz');
select throws_ok($$ update public.folders set gym_group = false
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, '42501', null, 'não deixa de ser grupo depois');

insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Perna', 'list');
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000004', 'Casa');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'Cartões', 'cards');
reset role;
select ok(public._is_workout_page('bbbbbbbb-0000-0000-0000-000000000001'), 'página do grupo é de treino');
select ok(not public._is_workout_page('bbbbbbbb-0000-0000-0000-000000000004'),
  'página de cards fora da Academia e dos grupos não é de treino (CD15)');

-- A Bia entra como editora: vê o grupo; o estranho não
insert into public.folder_members (folder_id, user_id, role)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select gym_group from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), true,
  'quem entra vê o grupo como grupo de treino');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'estranho não vê o grupo');

-- Feed: o treino do grupo vira um evento só
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Agachamento"},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Leg press"}]');
reset role;
update public.tasks set due_date = current_date + 1 where page_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;
create temp table tok as select public.calendar_feed_link() as t;
select ok(strpos(replace(public.calendar_ics((select t from tok)), E'\r\n ', ''),
  'SUMMARY:🏋 Perna') > 0, 'treino do grupo no feed como evento da página');

select * from finish();
rollback;
