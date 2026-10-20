-- ESCOPO_V6 AC3.6 (D235): catálogo de exercícios e exercícios próprios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Grupo', 'project');
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;

select ok((select count(*) from public.exercises) > 1000, 'catálogo legível por qualquer conta');
select throws_ok($$ insert into public.exercises (id, name_en, body_part, equipment) values ('x', 'x', 'chest', 'other') $$,
  '42501', null, 'catálogo é só leitura');

insert into public.user_exercises (id, name, body_part, equipment) values
  ('e0000000-0000-0000-0000-000000000001', 'Remada no banco do parque', 'back', 'bodyweight');
insert into public.user_exercises (id, folder_id, name, body_part, equipment) values
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Circuito do grupo', 'core', 'other');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino 4x10", "exercise_id": "mit-0025"}]');
select is((select exercise_id from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'mit-0025',
  'o lote liga o item ao exercício');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.user_exercises), 1, 'do grupo sim, o pessoal da Ana não');
update public.user_exercises set name = 'x' where id = 'e0000000-0000-0000-0000-000000000002';
select is((select name from public.user_exercises where id = 'e0000000-0000-0000-0000-000000000002'),
  'Circuito do grupo', 'só o dono muda');
select lives_ok($$ insert into public.user_exercises (name, body_part, equipment, folder_id)
  values ('Da Bia no grupo', 'legs', 'machine', 'aaaaaaaa-0000-0000-0000-000000000001') $$, 'editora cria no grupo');

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$ insert into public.user_exercises (name, body_part, equipment, folder_id)
  values ('Do leitor', 'legs', 'machine', 'aaaaaaaa-0000-0000-0000-000000000001') $$, '42501', null, 'leitor não cria no grupo');
select lives_ok($$ insert into public.user_exercises (name, body_part, equipment) values ('Meu', 'legs', 'machine') $$,
  'leitor cria o próprio');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.user_exercises), 0, 'estranho não vê nenhum');
select throws_ok($$ insert into public.user_exercises (owner_id, name, body_part, equipment)
  values ('11111111-1111-1111-1111-111111111111', 'Falso', 'legs', 'machine') $$, '42501', null, 'não cria em nome de outro');

select * from finish();
rollback;
