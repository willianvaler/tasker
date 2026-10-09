-- RLS base da Fase 0. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Dois usuários; o trigger de cadastro cria perfil + Caixa de entrada
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{}');

select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Ana',
  'perfil usa o display_name do cadastro');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'bia',
  'sem display_name, usa o início do e-mail');
select is((select count(*)::int from public.pages p join public.folders f on f.id = p.folder_id
           where f.owner_id = '11111111-1111-1111-1111-111111111111' and p.is_inbox and f.is_inbox), 1,
  'cadastro cria a Caixa de entrada');

-- Como Ana
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok($$ insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Academia') $$,
  'Ana cria uma pasta');
select is((select role::text from public.folder_members where folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'owner',
  'quem cria a pasta vira owner');
select lives_ok($$ insert into public.folders (id, parent_id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treinos') $$,
  'Ana cria uma subpasta');
select throws_ok($$ insert into public.folders (parent_id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Neta') $$,
  'P0001', null, 'não deixa criar um terceiro nível de pasta');
select lives_ok($$ insert into public.pages (id, folder_id, name, view_type) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Treino A', 'cards') $$,
  'Ana cria página na subpasta');
select lives_ok($$ insert into public.tasks (id, page_id, title) values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino') $$,
  'Ana cria tarefa');
select is((select folder_id from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
  'folder_id da tarefa vem da página');
select throws_ok($$ insert into public.tasks (page_id, folder_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'cliente não envia folder_id');
select throws_ok($$ update public.tasks set status = 'done' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'status só muda por RPC');
select throws_ok($$ update public.profiles set xp = 9999 where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'cliente não altera XP');
select lives_ok($$ insert into public.tasks (page_id, parent_task_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '4x12') $$,
  'Ana cria subtarefa');

-- Como Bia: não vê nada da Ana
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is((select count(*)::int from public.folders where owner_id = '11111111-1111-1111-1111-111111111111'), 0,
  'Bia não vê pastas da Ana');
select is((select count(*)::int from public.tasks), 0, 'Bia não vê tarefas da Ana');
select throws_ok($$ insert into public.tasks (page_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'invasão') $$,
  'P0001', 'Página não encontrada', 'Bia não cria tarefa na página da Ana (para ela a página não existe)');
select is((select count(*)::int from public.profiles), 1, 'Bia só vê o próprio perfil');

-- De volta à Ana: a Caixa de entrada não pode ser apagada (a policy filtra, nada é removido)
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.folders where is_inbox;
select is((select count(*)::int from public.folders where is_inbox), 1, 'Caixa de entrada não é apagada');

select * from finish();
rollback;
