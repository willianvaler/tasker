-- OB11 (D296): versões das anotações. Feitas pelo servidor (uma a cada 10 minutos), só a dona vê,
-- ninguém grava direto, restaurar guarda a de agora, contam no espaço, vão para a lixeira com a
-- anotação e entram na exportação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'editor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;

insert into public.notes (id, title, body) values ('cccccccc-0000-0000-0000-000000000001', 'Ideias', 'primeira');
insert into public.notes (id, title, body, folder_id) values
  ('cccccccc-0000-0000-0000-000000000002', 'Da casa', 'lista', 'aaaaaaaa-0000-0000-0000-000000000001');

update public.notes set body = 'segunda' where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select body from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  'primeira', 'gravar guarda o texto de antes');
update public.notes set body = 'terceira' where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  1, 'dentro de 10 minutos, não guarda outra');

-- A sessão seguinte (mais de 10 minutos depois) guarda de novo
reset role;
update public.note_versions set created_at = now() - interval '11 minutes';
set local role authenticated;
update public.notes set body = 'quarta' where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select array_agg(body order by body) from public.note_versions
           where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  array['primeira', 'terceira'], 'depois, guarda o fim da sessão anterior');
update public.notes set props = '{"nota": 5}' where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  2, 'mudar só a propriedade, logo depois, não guarda');

select ok((select public.attachment_usage()) >= (select sum(size) from public.note_versions), 'versões contam no espaço');
select ok((select public.note_versions_usage()) > 0, 'e aparecem à parte');

select throws_ok($$ insert into public.note_versions (note_id, user_id, body, size) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'falsa', 5) $$,
  '42501', null, 'o cliente não cria versão');
select throws_ok($$ update public.note_versions set body = 'outra' $$, '42501', null, 'nem muda');

-- Nota do projeto: a versão é da dona; o editor do projeto edita, mas não vê o histórico
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.notes set body = 'lista nova' where id = 'cccccccc-0000-0000-0000-000000000002';
select is((select count(*)::int from public.note_versions), 0, 'editor do projeto não vê as versões');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.note_versions), 0, 'estranho não vê');
select throws_ok($$ select public.restore_note_version(
  (select id from public.note_versions limit 1)) $$, 'P0002', null, 'estranho não restaura (nem acha)');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select user_id from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000002'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'a versão da nota do projeto é da dona');

-- Restaurar: volta à escolhida e a de agora vira versão (mesmo dentro dos 10 minutos)
select is((select public.restore_note_version(
            (select id from public.note_versions where body = 'primeira')) ->> 'body'), 'primeira',
  'restaurar devolve o texto');
select is((select body from public.notes where id = 'cccccccc-0000-0000-0000-000000000001'), 'primeira',
  'e a anotação volta');
select ok(exists (select 1 from public.note_versions where body = 'quarta'), 'a de antes de restaurar ficou guardada');

-- Pela fila do aparelho (o sync manda pelo run_once)
select is((select public.run_once(gen_random_uuid(), 'restore_note_version',
            jsonb_build_object('p_version', (select id from public.note_versions where body = 'quarta'))) ->> 'body'),
  'quarta', 'restaurar pela fila do sync');

-- Apagar uma versão libera espaço e não vai para a lixeira
delete from public.note_versions where body = 'terceira';
select is((select count(*)::int from public.deleted_items where kind = 'note_versions'), 0,
  'apagar uma versão não vai para a lixeira');

-- Apagar a anotação leva as versões para a lixeira, e restaurar traz tudo
delete from public.notes where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select kind from public.trash_list() limit 1), 'notes', 'na lixeira aparece a anotação');
select public.restore_deleted((select id from public.trash_list() limit 1));
select is((select count(*)::int from public.note_versions where note_id = 'cccccccc-0000-0000-0000-000000000001'),
  3, 'restaurar traz a anotação com as versões');

select ok((select public.export_my_data()) ? 'note_versions' and
          jsonb_array_length((select public.export_my_data()) -> 'notes') = 2, 'a exportação leva anotações e versões');

select * from finish();
rollback;
