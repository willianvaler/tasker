-- CS2 (D381): rodízio de tarefas. A vez passa ao concluir, pular avisa a próxima, trocar troca de
-- lugar, desfazer devolve, e a contagem fecha com o histórico. RLS: membro lê, estranho não.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local'),
  ('55555555-5555-5555-5555-555555555555', 'leitor@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tarefas da casa');
insert into public.tasks (id, page_id, title, due_date, recurrence) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Lavar a louça',
   current_date, '{"type": "daily"}');

reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'contributor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'contributor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'viewer');

-- Quem não escolhe responsáveis não liga o rodízio
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$select public.set_task_rotation('cccccccc-0000-0000-0000-000000000001',
  array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[])$$,
  '42501', null, 'colaborador não liga o rodízio');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$select public.set_task_rotation('cccccccc-0000-0000-0000-000000000001',
  array['11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444']::uuid[])$$,
  '22023', null, 'quem não é do projeto não entra');
select throws_ok($$select public.set_task_rotation('cccccccc-0000-0000-0000-000000000001',
  array['11111111-1111-1111-1111-111111111111']::uuid[])$$,
  '22023', null, 'uma pessoa só não é rodízio');
select throws_ok($$insert into public.task_rotations (task_id, folder_id, members)
  values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
          array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[])$$,
  '42501', null, 'ninguém grava direto na tabela');

-- Ana, Bia, Caio: a Ana começa
select lives_ok($$select public.set_task_rotation('cccccccc-0000-0000-0000-000000000001',
  array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333']::uuid[])$$, 'a dona liga o rodízio');
select results_eq($$select user_id from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid)$$, 'a primeira da ordem é a responsável');

-- Ana conclui: a vez é da Bia, que recebe o aviso
select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select results_eq($$select user_id from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid)$$, 'concluir passa a vez para a Bia');
select is((public.task_rotation_state('cccccccc-0000-0000-0000-000000000001') ->> 'current_index')::int, 1,
  'o índice avançou');

-- Desfazer devolve a vez para a Ana
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000001');
select results_eq($$select user_id from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid)$$, 'desfazer devolve a vez');
select public.complete_task('cccccccc-0000-0000-0000-000000000001');

-- A Bia (na vez) pula: vai para o Caio, que é avisado
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$select public.rotation_pass('cccccccc-0000-0000-0000-000000000001')$$, 'quem está na vez pula');
reset role;
select results_eq($$select user_id from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('33333333-3333-3333-3333-333333333333'::uuid)$$, 'pular passa para o Caio');
select ok(exists (select 1 from public.notifications
  where user_id = '33333333-3333-3333-3333-333333333333' and kind = 'assigned'
    and payload ->> 'task_id' = 'cccccccc-0000-0000-0000-000000000001'), 'o Caio recebe o aviso');

-- A Bia não pode passar a vez do Caio
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$select public.rotation_pass('cccccccc-0000-0000-0000-000000000001')$$,
  '42501', null, 'fora da vez, colaborador não passa');

-- O Caio troca com a Ana: a Ana faz agora e o Caio fica no lugar dela na ordem
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok($$select public.rotation_pass('cccccccc-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111')$$, 'trocar com a Ana');
select is(public.task_rotation_state('cccccccc-0000-0000-0000-000000000001') -> 'members',
  '["33333333-3333-3333-3333-333333333333", "22222222-2222-2222-2222-222222222222", "11111111-1111-1111-1111-111111111111"]'::jsonb,
  'as duas trocaram de lugar');
reset role;
select results_eq($$select user_id from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid)$$, 'a Ana é a responsável');

-- Contagem: Ana concluiu uma vez (a desfeita não conta); fecha com o histórico
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select is((select sum((c ->> 'total')::int) from jsonb_array_elements(
  public.task_rotation_state('cccccccc-0000-0000-0000-000000000001') -> 'counts') c)::int,
  (select count(*)::int from public.task_completions where task_id = 'cccccccc-0000-0000-0000-000000000001'),
  'a contagem fecha com o histórico');
select is((select (c ->> 'week')::int from jsonb_array_elements(
  public.task_rotation_state('cccccccc-0000-0000-0000-000000000001') -> 'counts') c
  where c ->> 'user_id' = '11111111-1111-1111-1111-111111111111'), 2, 'a Ana fez duas nesta semana');

-- Leitura: o leitor vê, o estranho não
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is((select count(*)::int from public.task_rotations), 1, 'o leitor vê o rodízio');
select throws_ok($$select public.rotation_pass('cccccccc-0000-0000-0000-000000000001')$$,
  '42501', null, 'o leitor não passa a vez');
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.task_rotations), 0, 'o estranho não vê');
select is(public.task_rotation_state('cccccccc-0000-0000-0000-000000000001'), null, 'nem o estado');

-- Por semana: a varredura passa a vez só quando a semana vira
reset role;
update public.task_rotations set mode = 'week', week_key = public._rotation_week(folder_id)
where task_id = 'cccccccc-0000-0000-0000-000000000001';
select is(public.rotation_sweep(), 0, 'na mesma semana, nada muda');
update public.task_rotations set week_key = '2000-W01' where task_id = 'cccccccc-0000-0000-0000-000000000001';
select is(public.rotation_sweep(), 1, 'na semana seguinte, a vez passa');

select * from finish();
rollback;
