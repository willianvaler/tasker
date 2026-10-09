-- Fase 4: convites, papéis, responsáveis pendentes, comentários, atividade, notificações e modelos.
-- Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

select is(public.name_key('Grégory Silva'), 'gregorysilva', 'name_key: sem acento, espaço nem maiúscula');
select is(public.name_key('@cris'), 'cris', 'name_key tira o @');

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"display_name": "Ana Lima"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{"display_name": "Bia"}'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local', '{"display_name": "Caio"}'),
  ('44444444-4444-4444-4444-444444444444', 'duda@teste.local', '{"display_name": "Duda"}');

-- ---------- Ana monta o projeto antes de convidar ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Churrasco');
insert into public.folders (id, parent_id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Compras');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lista'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Mercado');

select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001', '[
  {"id": "cccccccc-0000-0000-0000-000000000001", "title": "Carne", "assignees": [{"pending_name": "gregory"}]},
  {"id": "cccccccc-0000-0000-0000-000000000002", "title": "Cerveja", "assignees": [{"pending_name": "@Cris"}]},
  {"id": "cccccccc-0000-0000-0000-000000000003", "title": "Carvão", "assignees": [{"user_id": "11111111-1111-1111-1111-111111111111"}]}
]');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002', '[
  {"id": "cccccccc-0000-0000-0000-000000000004", "title": "Gelo", "assignees": [{"pending_name": "Gregory"}]}
]');
select is((select count(*)::int from public.task_assignees), 4, 'lote grava responsáveis (membro e pendentes)');
select is((select pending_name from public.task_assignees where task_id = 'cccccccc-0000-0000-0000-000000000002'), 'Cris',
  'o @ sai do nome pendente');
select is(public.pending_names('aaaaaaaa-0000-0000-0000-000000000001'), array['Cris', 'gregory'],
  'nomes pendentes do projeto, inclusive da subpasta, sem repetir');
select is((select count(*)::int from public.activity_log), 0, 'pasta pessoal não tem atividade');
select throws_ok($$ insert into public.task_assignees (task_id, user_id) values ('cccccccc-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444') $$,
  '22023', null, 'quem não é membro não vira responsável');

-- Convite
create temp table inv on commit drop as
  select * from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001');
select is((select char_length(token) from inv), 24, 'token aleatório de 24 caracteres');
select is((public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')).token, (select token from inv),
  'o mesmo link enquanto valer');
select ok((select is_shared from public.folders where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'convidar vira projeto');
select throws_ok($$ select public.create_invite('aaaaaaaa-0000-0000-0000-000000000002') $$, '22023', null,
  'subpasta não se compartilha sozinha');
select throws_ok($$ select public.create_invite((select id from public.folders where is_inbox)) $$, '22023', null,
  'Caixa de entrada não se compartilha');
select throws_ok($$ select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'owner') $$, '22023', null,
  'convite não dá o papel de dono');
create temp table inv_viewer on commit drop as
  select * from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'viewer');
grant select on inv, inv_viewer to anon, authenticated;

-- ---------- Sem login: só a prévia ----------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.invite_preview((select token from inv)) ->> 'folder_name', 'Churrasco', 'prévia do convite sem login');
select is(public.invite_preview('nao-existe') ->> 'valid', 'false', 'token errado não vale');
select throws_ok($$ select public.accept_invite((select token from inv)) $$, '42501', null, 'aceitar exige login');

-- ---------- Bia entra pelo link ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.invites), 0, 'quem não é membro não lista convites');
select is(public.accept_invite((select token from inv)) -> 'pending', '["Cris", "gregory"]'::jsonb,
  'ao entrar, vê os nomes pendentes');
select is((select role::text from public.folder_members where user_id = auth.uid() and folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'editor', 'entra como editora (padrão do convite)');
select is((public.accept_invite((select token from inv)) ->> 'joined')::boolean, false, 'aceitar de novo não duplica');
select is((select count(*)::int from public.tasks), 4, 'membro vê as tarefas do projeto (e da subpasta)');

select is(public.claim_pending_assignee('aaaaaaaa-0000-0000-0000-000000000001', '@Gregory'), 2,
  '"Sou o @gregory": as tarefas dele (inclusive na subpasta) passam para a Bia');
select is(public.pending_names('aaaaaaaa-0000-0000-0000-000000000001'), array['Cris'], 'gregory não está mais pendente');
select throws_ok($$ select public.claim_pending_assignee('aaaaaaaa-0000-0000-0000-000000000001', 'Cris', '44444444-4444-4444-4444-444444444444') $$,
  '22023', null, 'não vincula quem não é membro');
select is((select aliases from public.folder_members where user_id = auth.uid() and folder_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  array['Gregory'], 'o nome vira apelido da Bia');

-- Atividade de conclusão, e desfazer apaga
select public.complete_task('cccccccc-0000-0000-0000-000000000001');
select is((select count(*)::int from public.activity_log where action = 'task_completed'), 1, 'concluir aparece na atividade');
select public.uncomplete_task('cccccccc-0000-0000-0000-000000000001');
select is((select count(*)::int from public.activity_log where action = 'task_completed'), 0, 'desfazer some da atividade');

-- Comentário com @menção
insert into public.comments (task_id, body) values ('cccccccc-0000-0000-0000-000000000003', 'Compro o @ana? Ou a @analima');
select is((select count(*)::int from public.activity_log where action = 'comment_added'), 1, 'comentário na atividade');
select throws_ok($$ insert into public.comments (task_id, author_id, body) values ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'falso') $$,
  '42501', null, 'não comenta em nome de outro');

-- ---------- Ana: notificações ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'member_joined'), 1, 'dono sabe que a Bia entrou');
select is((select count(*)::int from public.notifications where kind = 'mention'), 1, '@ana e @analima: uma notificação só');
select is((select count(*)::int from public.notifications where kind = 'assigned'), 0,
  'atribuir a si mesma não notifica');
insert into public.task_assignees (task_id, user_id) values ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');
select lives_ok($$ update public.notifications set read_at = now() $$, 'marca as próprias como lidas');
select throws_ok($$ update public.notifications set kind = 'assigned' $$, '42501', null, 'mas não muda o resto');
select throws_ok($$ select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'viewer') $$,
  'P0002', null, 'o papel do dono não muda');

-- ---------- Caio entra como leitor ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.accept_invite((select token from inv_viewer));
select lives_ok($$ insert into public.comments (task_id, body) values ('cccccccc-0000-0000-0000-000000000001', 'Eu levo a farofa') $$,
  'leitor comenta');
select throws_ok($$ insert into public.task_assignees (task_id, pending_name) values ('cccccccc-0000-0000-0000-000000000001', 'zé') $$,
  '42501', null, 'leitor não atribui');
select throws_ok($$ select public.complete_task('cccccccc-0000-0000-0000-000000000001') $$, 'P0002', null, 'leitor não conclui');
select throws_ok($$ select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001') $$, 'P0002', null, 'leitor não convida');
select throws_ok($$ select public.claim_pending_assignee('aaaaaaaa-0000-0000-0000-000000000001', 'Cris', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'leitor não vincula outra pessoa');

-- ---------- Bia (editora) não manda nos papéis ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'assigned'), 1,
  'Bia foi avisada ao ser atribuída (reivindicar o próprio nome não avisa ela mesma)');
select throws_ok($$ select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'editor') $$,
  '42501', null, 'editor não muda papéis');

-- ---------- Duda, de fora, não vê nada ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.task_assignees) + (select count(*)::int from public.comments)
          + (select count(*)::int from public.activity_log) + (select count(*)::int from public.notifications)
          + (select count(*)::int from public.invites), 0, 'estranho não vê responsáveis, comentários, atividade, avisos nem convites');

-- ---------- Ana tira a Bia: as tarefas dela voltam a pendentes ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.remove_member('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.task_assignees where pending_name = 'Bia'), 3,
  'quem sai deixa as tarefas com o nome dela, pendente');
select public.revoke_invites('aaaaaaaa-0000-0000-0000-000000000001');
select is(public.invite_preview((select token from inv)) ->> 'valid', 'false', 'link cancelado para de funcionar');

-- ---------- Modelos ----------
create temp table tpl on commit drop as
  select public.create_from_template('Viagem', '✈️', '{"pages": [
    {"name": "Mala", "view_type": "cards", "items": [{"title": "Roupas"}, {"title": "Remédios", "children": [{"title": "Dipirona"}]}]},
    {"name": "Roteiro", "items": []}
  ]}') as id;
select is((select count(*)::int from public.pages where folder_id = (select id from tpl)), 2, 'modelo cria as páginas');
select is((select count(*)::int from public.tasks where folder_id = (select id from tpl)), 3, 'e as tarefas, com subtarefas');
select ok((select is_shared from public.folders where id = (select id from tpl)), 'modelo já nasce como projeto');
create temp table saved on commit drop as
  select public.save_folder_as_template('aaaaaaaa-0000-0000-0000-000000000001', 'Meu churrasco') as id;
select is((select jsonb_array_length(data -> 'pages') from public.user_templates where id = (select id from saved)), 2,
  'salvar como modelo leva as páginas da pasta e das subpastas');

select * from finish();
rollback;
