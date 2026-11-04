-- OB14 (D300): compartilhar anotação pessoal com amigos (ler/editar) e publicar em /p/<token>.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitora@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'editora@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@teste.local');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'accepted', now()),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'accepted', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'folder');
insert into public.notes (id, title, body) values
  ('cccccccc-0000-0000-0000-000000000001', 'Ideias', 'ver [[Outra|n:cccccccc-0000-0000-0000-000000000003]] e [[Segredo|n:cccccccc-0000-0000-0000-000000000005]]'),
  ('cccccccc-0000-0000-0000-000000000003', 'Outra', 'texto da outra'),
  ('cccccccc-0000-0000-0000-000000000004', 'Solta', 'não citada');
insert into public.notes (id, title, body, folder_id) values
  ('cccccccc-0000-0000-0000-000000000002', 'Da pasta', 'x', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.notes (id, title, body, is_template) values
  ('cccccccc-0000-0000-0000-000000000006', 'Modelo', 'm', true);

-- Compartilhar
select is(public.share_note('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'read'),
  'added', 'a dona compartilha com amiga, para ler');
select is(public.share_note('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'read'),
  'added', 'e com outra');
select is(public.share_note('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'edit'),
  'updated', 'mudar o papel');
select throws_ok($$ select public.share_note('cccccccc-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'só com amigos');
select throws_ok($$ select public.share_note('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222') $$,
  '22023', null, 'anotação de pasta não se compartilha');
select throws_ok($$ select public.share_note('cccccccc-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222') $$,
  '22023', null, 'modelo não se compartilha');
select throws_ok($$ select public.share_note('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin') $$,
  '22023', null, 'papel inválido');
select throws_ok($$ insert into public.note_shares (note_id, user_id, owner_id) values
  ('cccccccc-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'ninguém grava direto');
select is((select count(*)::int from public.note_shares), 2, 'a dona vê com quem compartilhou');
reset role;
select is((select count(*)::int from public.notifications where kind = 'note_shared'
           and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'quem recebe é avisado');
set local role authenticated;

-- Quem lê
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select title from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'), 'Ideias',
  'quem recebe para ler vê a anotação');
select is((select count(*)::int from public.notes where id = 'cccccccc-0000-0000-0000-000000000004'), 0,
  'e só ela');
select is((select count(*)::int from public.links where source_id = 'cccccccc-0000-0000-0000-000000000001'), 2,
  'vê os links dela');
select is((select count(*)::int from public.note_shares), 1, 'vê só o próprio compartilhamento');
update public.notes set body = 'mudei' where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select isnt((select body from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'), 'mudei',
  'quem lê não muda');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
delete from public.notes where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'), 1,
  'nem apaga');

-- Quem edita
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
update public.notes set body = 'ver [[Outra|n:cccccccc-0000-0000-0000-000000000003]] e mais'
  where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select body from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'),
  'ver [[Outra|n:cccccccc-0000-0000-0000-000000000003]] e mais', 'quem recebe para editar muda o texto');
select throws_ok($$ update public.notes set pinned = true where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'mas não fixa');
select throws_ok($$ update public.notes set is_template = true where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'nem vira modelo');
delete from public.notes where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'), 1,
  'nem apaga');
reset role;
select is((select user_id from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'a versão guardada é da dona');
set local role authenticated;

-- Estranho
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*)::int from public.notes), 0, 'estranho não vê');
select throws_ok($$ select public.unshare_note('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  'P0002', null, 'nem tira ninguém');

-- Sair e desfazer a amizade
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.unshare_note('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  'quem recebeu sai');
select is((select count(*)::int from public.notes), 0, 'e deixa de ver');
reset role;
delete from public.friendships where user_b = '33333333-3333-3333-3333-333333333333';
select is((select count(*)::int from public.note_shares), 0, 'amizade desfeita tira o compartilhamento');
set local role authenticated;

-- Publicar
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.publish_note('cccccccc-0000-0000-0000-000000000002') $$,
  '22023', null, 'anotação de pasta não se publica');
select ok(length(public.publish_note('cccccccc-0000-0000-0000-000000000001', true)) >= 20, 'a dona publica');
select throws_ok($$ select password_hash from public.note_publications $$, '42501', null,
  'nem a dona lê o hash da senha');
reset role;
create temp table pub_tok as select token from public.note_publications;
grant select on pub_tok to anon, authenticated;

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((public.published_note((select token from pub_tok)) -> 'note' ->> 'title'), 'Ideias',
  'sem conta, abre pelo endereço');
reset role;
select is((select jsonb_agg(n ->> 'title') from jsonb_array_elements(
  public.published_note((select token from pub_tok)) -> 'notes') n),
  '["Ideias", "Outra"]'::jsonb, 'com as ligadas (as pessoais citadas)');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.publish_note('cccccccc-0000-0000-0000-000000000001', true, 'segredo1') $$,
  'pôr senha');
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((public.published_note('x') ->> 'status'), 'missing', 'endereço que não existe');
reset role;
select is((public.published_note((select token from pub_tok)) ->> 'status'), 'password',
  'com senha, pede a senha');
select is((public.published_note((select token from pub_tok), 'errada') ->> 'status'), 'wrong',
  'senha errada');
select is((public.published_note((select token from pub_tok), 'segredo1',
  'cccccccc-0000-0000-0000-000000000004') ->> 'status'), 'missing', 'anotação fora do conjunto não abre');
select is((public.published_note((select token from pub_tok), 'segredo1',
  'cccccccc-0000-0000-0000-000000000003') -> 'note' ->> 'body'), 'texto da outra', 'com a senha, abre a ligada');

select * from finish();
rollback;
