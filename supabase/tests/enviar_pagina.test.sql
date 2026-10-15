-- V3 §3.2 (L3): enviar por link (ao vivo e cópia) e por e-mail; aceitar, recusar, revogar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'treinador@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'aluna.a@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'aluno.b@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'aluna.c@teste.local'),
  ('55555555-5555-5555-5555-555555555555', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alunos', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'viewer');
set local role authenticated;
insert into public.pages (id, folder_id, name, view_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Treino A', 'cards');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Supino'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Remada');

create temp table links (mode text, token text);
grant all on links to authenticated;
insert into links select 'live', (public.create_share_link('bbbbbbbb-0000-0000-0000-000000000001', 'live')).token;
insert into links select 'copy', (public.create_share_link('bbbbbbbb-0000-0000-0000-000000000001', 'copy')).token;
select is((public.page_share_preview((select token from links where mode = 'live')) ->> 'own')::boolean, true,
  'a prévia sabe que o link é do treinador');
select throws_ok($$ select public.accept_page_share_link((select token from links where mode = 'live')) $$,
  '22023', null, 'o treinador não aceita o próprio link');
select is(public.share_page_by_email('bbbbbbbb-0000-0000-0000-000000000001',
  array['ALUNA.C@teste.local', 'nova@teste.local', 'invalido', 'treinador@teste.local'], 'live'), 2,
  'e-mail: um que já tem conta, um novo; inválido e o próprio ficam de fora');

-- Aluna A pelo link ao vivo
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((public.page_share_preview((select token from links where mode = 'live')) ->> 'page_name'), 'Treino A',
  'prévia mostra a página');
select is((public.accept_page_share_link((select token from links where mode = 'live')) ->> 'page_id'),
  'bbbbbbbb-0000-0000-0000-000000000001', 'aceitar abre a própria página (ao vivo)');
select ok(public.is_page_recipient('bbbbbbbb-0000-0000-0000-000000000001'), 'e agora ela recebe a página');
select is((select onboarded_at is not null from public.profiles where id = auth.uid()), true,
  'quem entra por envio não passa pela introdução');

-- Aluno B pelo link de cópia: ganha a página dele
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
create temp table copia as select (public.accept_page_share_link((select token from links where mode = 'copy'), 'Recebidas') ->> 'page_id')::uuid as id;
select isnt((select id from copia), 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'cópia é outra página');
select is((select count(*)::int from public.tasks where page_id = (select id from copia)), 2, 'com os itens');
select is((select f.name from public.pages p join public.folders f on f.id = p.folder_id where p.id = (select id from copia)),
  'Recebidas', 'numa pasta dele');
select lives_ok($$ update public.tasks set title = 'Supino reto' where page_id = (select id from copia) and title = 'Supino' $$,
  'a cópia é dele: edita');
select ok(not public.is_page_recipient('bbbbbbbb-0000-0000-0000-000000000001'), 'e não vê a original');

-- Aluna C: convite por e-mail, pendente até aceitar
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select status from public.page_shares), 'pending', 'a aluna C vê o convite pendente');
select lives_ok($$ select public.accept_page_share((select id from public.page_shares)) $$, 'e aceita');
select ok(public.is_page_recipient('bbbbbbbb-0000-0000-0000-000000000001'), 'agora recebe');

-- Leitor do projeto não envia
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select throws_ok($$ select public.create_share_link('bbbbbbbb-0000-0000-0000-000000000001') $$, '42501', null,
  'Leitor não envia a página');

select * from finish();
rollback;
