-- V6 AC15C: desafio estilo GymRats. Membros próprios, código para entrar, quem criou tira gente e
-- troca ou cancela o código, mural e chat do desafio, atividades com séries e minutos, ranking
-- pelo critério escolhido.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');
-- Bia é amiga da Ana
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'accepted', now());

select is(public._activity_points(25, 12), 24, 'pontos: 10 do treino, 1 por série, 1 a cada 10 min');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.create_challenge('X', 7, 'days', array['44444444-4444-4444-4444-444444444444'::uuid]) $$,
  '22023', null, 'estranho não entra pela criação');
select throws_ok($$ select public.create_challenge('X', 7, 'pizza') $$, '23514', null, 'critério da lista');
create temp table c as
  select public.create_challenge('Outubro', 30, 'points', array['22222222-2222-2222-2222-222222222222'::uuid]) as id;
grant select on c to authenticated;
select is((select count(*)::int from public.challenge_members where challenge_id = (select id from c)), 2,
  'Ana e Bia no desafio, sem projeto nem time');
select matches((select code from public.challenges where id = (select id from c)), '^[A-Z2-9]{8}$',
  'nasce com código de 8');
select is((select count(*)::int from public.notifications where user_id = '22222222-2222-2222-2222-222222222222'
           and kind = 'challenge_started'), 0, 'o aviso da Bia não aparece para a Ana');

-- Sem login: a prévia do código
reset role;
create temp table code as select code from public.challenges where id = (select id from c);
grant select on code to anon, authenticated;
set local role anon;
select is((public.challenge_preview((select code from code)) ->> 'members'), '2', 'prévia sem login');
select is((public.challenge_preview('NAOEXIST') ->> 'valid'), 'false', 'código errado');
select throws_ok($$ select public.join_challenge((select code from code)) $$, '42501', null, 'sem login não entra');

-- Estranho entra pelo código e vê o desafio, o ranking e o mural
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.challenges where id = (select id from c)), 0, 'antes de entrar, não vê');
select is(public.join_challenge(lower((select code from code))), (select id from c), 'entra pelo código');
select is((select count(*)::int from public.challenge_board((select id from c))), 3, 'ranking com os três');
select lives_ok($$ insert into public.group_posts (challenge_id, kind, body)
  values ((select id from c), 'message', 'cheguei') $$, 'quem entrou conversa');
select throws_ok($$ insert into public.group_posts (challenge_id, kind, body, photo_path)
  values ((select id from c), 'checkin', 'x', 'c/' || (select id from c) || '/11111111-1111-1111-1111-111111111111/a.webp') $$,
  '42501', null, 'foto só na própria pasta do desafio');
select throws_ok($$ select public.set_challenge_code((select id from c), false) $$, '42501', null,
  'só quem criou mexe no código');
select throws_ok($$ select public.remove_challenge_member((select id from c), '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'só quem criou tira gente');

-- Caio, de fora, não vê nada
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.group_posts where challenge_id = (select id from c)), 0,
  'quem não é do desafio não vê o mural');
select throws_ok($$ insert into public.group_posts (challenge_id, kind, body) values ((select id from c), 'message', 'oi') $$,
  '42501', null, 'nem escreve');
select throws_ok($$ select * from public.challenge_board((select id from c)) $$, 'P0002', null, 'nem vê o ranking');

-- Ana tira o estranho e cancela o código
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.remove_challenge_member((select id from c), '44444444-4444-4444-4444-444444444444');
select is(public.set_challenge_code((select id from c), false), null, 'código cancelado');
select throws_ok($$ select public.remove_challenge_member((select id from c), '11111111-1111-1111-1111-111111111111') $$,
  '22023', null, 'quem criou não sai');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.challenges where id = (select id from c)), 0, 'quem foi tirado não vê');
select throws_ok($$ select public.join_challenge((select code from code)) $$, 'P0002', null,
  'código cancelado não entra');

-- Atividade: o treino da Bia concluído vira atividade com as séries do diário
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.folders (id, name, kind, gym_group) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Turma', 'project', true);
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Supino"}]');
reset role;
insert into public.workout_sets (user_id, task_id, page_id, exercise_name, weight_kg, reps, performed_at, warmup) values
  ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', 40, 10, now() - interval '20 minutes', false),
  ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', 40, 10, now(), false),
  ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino', 20, 10, now(), true);
set local role authenticated;
select public.complete_task('c0000000-0000-0000-0000-000000000001');
select is((select sets || ' ' || minutes || ' ' || volume_kg from public.workout_activities),
  '2 20 800.0', 'atividade com séries, minutos e volume (sem aquecimento)');
select is((select (activities -> 0 ->> 'sets') from public.challenge_board((select id from c))
           where user_id = '22222222-2222-2222-2222-222222222222'), '2', 'a atividade aparece no ranking');
reset role;
select is((select score from public._challenge_scores((select id from c))
           where user_id = '22222222-2222-2222-2222-222222222222'), 14, 'pontos da Bia: 10 + 2 séries + 2');
update public.challenges set scoring = 'minutes' where id = (select id from c);
select is((select score from public._challenge_scores((select id from c))
           where user_id = '22222222-2222-2222-2222-222222222222'), 20, 'por minutos');

select * from finish();
rollback;
