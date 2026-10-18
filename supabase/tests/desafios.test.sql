-- V6 AC10.4: desafios do grupo (projeto ou time), dia de treino, mural, chat e reações.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Turma', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards', 'weekly'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras', 'list', 'none');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino"},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Remada"}]');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002',
  '[{"id": "c0000000-0000-0000-0000-000000000003", "title": "Leite"}]');

-- Desafio
select throws_ok($$ select public.start_challenge(null, null, 'X', 7) $$, '22023', null, 'precisa de um grupo');
select throws_ok($$ select public.start_challenge('aaaaaaaa-0000-0000-0000-000000000001', null, 'X', 0) $$,
  '23514', null, 'duração de 1 a 365 dias');
create temp table c as select public.start_challenge('aaaaaaaa-0000-0000-0000-000000000001', null, '30 dias', 30) as id;
grant select on c to authenticated;
select is((select ends_on - starts_on from public.challenges), 29, '30 dias contando o primeiro');

-- Dia de treino: página de treino toda feita conta; lista comum não
select public.complete_task('c0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.workout_days), 0, 'metade da página não conta');
select public.complete_task('c0000000-0000-0000-0000-000000000002');
select is((select source from public.workout_days), 'page', 'página de treino concluída conta o dia');
select public.complete_task('c0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.workout_days), 1, 'um por dia');

-- Sessão: 30 min ou mais conta (Bia), menos não (leitor)
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
reset role;
update public.tasks set status = 'todo' where page_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;
create temp table s as select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001') as id;
grant select on s to authenticated;
reset role;
update public.workout_session_members set joined_at = now() - interval '31 minutes'
where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select public.leave_workout_session((select id from s));
select is((select minutes from public.workout_days), 31, 'sessão de 31 min conta o dia da Bia');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
create temp table s2 as select public.start_workout_session('bbbbbbbb-0000-0000-0000-000000000001') as id;
select public.leave_workout_session((select id from s2));
select is((select count(*)::int from public.workout_days), 0, 'sessão curta não conta');
select is((select count(*)::int from public.workout_days where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'dia de treino dos outros não aparece direto');

-- Ranking
select is((select cardinality(days) from public.challenge_board((select id from c))
           where user_id = '11111111-1111-1111-1111-111111111111'), 1, 'ranking com o dia da Ana');
select is((select count(*)::int from public.challenge_board((select id from c))), 3, 'todos do grupo no ranking');
select throws_ok($$ select public.start_challenge('aaaaaaaa-0000-0000-0000-000000000001', null, 'Meu', 7) $$,
  '42501', null, 'leitor não cria desafio');

-- Mural e chat: leitor conversa
select lives_ok($$ insert into public.group_posts (folder_id, kind, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'message', 'bom dia') $$, 'leitor manda mensagem no chat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.group_posts (id, folder_id, kind, body, photo_path) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'checkin', 'Treino A feito',
   'f/aaaaaaaa-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/foto.webp');
select throws_ok($$ insert into public.group_posts (folder_id, kind, body, photo_path)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'checkin', 'x',
          'f/aaaaaaaa-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222/foto.webp') $$,
  '42501', null, 'foto só na própria pasta');
select throws_ok($$ insert into public.group_posts (folder_id, kind, body, user_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'message', 'x', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'não posta em nome de outro');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ insert into public.group_posts (folder_id, kind, parent_id, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'comment', 'dddddddd-0000-0000-0000-000000000001', 'boa!') $$,
  'comentário no check-in');
select lives_ok($$ insert into public.group_post_reactions (post_id, emoji)
  values ('dddddddd-0000-0000-0000-000000000001', '💪') $$, 'reação');
select throws_ok($$ insert into public.group_post_reactions (post_id, emoji)
  values ('dddddddd-0000-0000-0000-000000000001', '🍕') $$, '23514', null, 'só as reações da lista');
delete from public.group_posts where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select count(*)::int from public.group_posts where kind = 'checkin'), 1, 'não apaga o post dos outros');

-- Estranho
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.group_posts), 0, 'estranho não vê o mural');
select is((select count(*)::int from public.challenges), 0, 'estranho não vê o desafio');
select throws_ok($$ select * from public.challenge_board((select id from c)) $$, 'P0002', null,
  'estranho não vê o ranking');
select throws_ok($$ insert into public.group_posts (folder_id, kind, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'message', 'oi') $$, '42501', null, 'estranho não escreve');

-- Time
reset role;
insert into public.teams (id, name, created_by) values ('eeeeeeee-0000-0000-0000-000000000001', 'Corrida', '33333333-3333-3333-3333-333333333333');
-- O dono entra no time pelo trigger
set local role authenticated;
select isnt(public.start_challenge(null, 'eeeeeeee-0000-0000-0000-000000000001', 'Outubro', 31), null::uuid,
  'dono do time cria desafio do time');

select * from finish();
rollback;
