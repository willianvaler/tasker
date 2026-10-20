-- PB2 (D222): reações nas tarefas concluídas e nos comentários do projeto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Carvão"},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Gelo"}]');
select public.complete_task('c0000000-0000-0000-0000-000000000001');
insert into public.comments (id, task_id, body) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Eu levo dois sacos');

-- Bia reage à tarefa concluída pela Ana: Ana é avisada, uma vez só
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '👏') $$,
  'membro reage a tarefa concluída');
select is((select folder_id from public.reactions), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'folder_id vem da tarefa');
select throws_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '👏') $$,
  '23505', null, 'a mesma reação duas vezes não');
select lives_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '🔥') $$,
  'outro emoji pode');
select throws_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '💩') $$,
  '23514', null, 'só os emojis da lista');
select throws_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000002', '👏') $$,
  '22023', null, 'tarefa aberta não recebe reação');
select lives_ok($$ insert into public.reactions (task_id, comment_id, emoji)
  values ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '❤️') $$,
  'reação a comentário (tarefa aberta)');
select throws_ok($$ insert into public.reactions (task_id, comment_id, emoji)
  values ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '❤️') $$,
  '23503', null, 'o comentário tem de ser da tarefa');

reset role;
select is((select count(*)::int from public.notifications where user_id = '11111111-1111-1111-1111-111111111111'
  and kind = 'reaction' and payload ->> 'comment_id' is null), 1, 'um aviso por pessoa e tarefa enquanto não lido');
select is((select payload ->> 'emoji' from public.notifications where user_id = '11111111-1111-1111-1111-111111111111'
  and kind = 'reaction' and payload ->> 'comment_id' is not null), '❤️', 'quem comentou é avisado');
set local role authenticated;

-- Leitor reage (como comenta); estranho não vê nem grava
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '🎉') $$,
  'leitor reage');
select is((select count(*)::int from public.reactions), 4, 'membro vê as reações do projeto');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.reactions), 0, 'estranho não vê');
select throws_ok($$ insert into public.reactions (task_id, emoji) values ('c0000000-0000-0000-0000-000000000001', '💪') $$,
  '42501', null, 'estranho não reage');

-- Cada um apaga só a sua
delete from public.reactions;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
delete from public.reactions where emoji = '🎉';
select is((select count(*)::int from public.reactions), 4, 'não apaga a do outro');
delete from public.reactions where emoji = '🔥';
select is((select count(*)::int from public.reactions), 3, 'apaga a própria');

select * from finish();
rollback;
