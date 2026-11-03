-- OB4 (D289): propriedades e etiquetas das anotações. As etiquetas são calculadas pelo banco
-- (note_tags, espelho em src/lib/note-props.ts com os mesmos casos); o cliente escreve só `props`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Os mesmos casos do teste do app (note-props.test.ts → noteTags)
select is(public.note_tags(E'#Treino/Perna e #casa\n```\n#nao\n```\n`#nao2` x#nao3 #2026 #a//b/ ## titulo #ação', '{"tags":["#Leitura","casa"]}'),
  array['leitura', 'casa', 'treino/perna', 'a/b', 'ação'], 'texto e propriedade, sem código, número, link nem título');
select is(public.note_tags('oi', '{"tags":"a, b ,#c"}'), array['a', 'b', 'c'], 'tags em texto separado por vírgula');
select is(public.note_tags('#Casa e #casa, #fim.', '{}'), array['casa', 'fim'], 'sem repetir; pontuação fecha');
select is(public.note_tags(E'linha\n#começo da linha\ttab #x_y-z', '{"tags":[1, null, "ok"]}'), array['ok', 'começo', 'x_y-z'],
  'começo de linha conta; item que não é texto fica fora');
select is(public.note_tags('', '{}'), '{}'::text[], 'nada');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranho@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'leitor@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.notes (id, title, body, props) values
  ('dddddddd-0000-0000-0000-000000000001', 'Livro', 'Lido em #leitura/ficcao', '{"nota": 4, "lido": true, "aliases": ["O livro"]}') $$,
  'dona escreve com propriedades');
select is((select tags from public.notes where id = 'dddddddd-0000-0000-0000-000000000001'), array['leitura/ficcao'],
  'etiquetas calculadas ao criar');
update public.notes set props = props || '{"tags": ["favorito"]}' where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select tags from public.notes where id = 'dddddddd-0000-0000-0000-000000000001'), array['favorito', 'leitura/ficcao'],
  'e refeitas ao mudar as propriedades');
select throws_ok($$ update public.notes set tags = '{falsa}' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '42501', null, 'o cliente não escreve as etiquetas');
select throws_ok($$ insert into public.notes (title, props) values ('x', '[1, 2]') $$,
  '23514', null, 'propriedades são um objeto');
select throws_ok($$ insert into public.notes (title, props) values ('x', jsonb_build_object('a', repeat('b', 9000))) $$,
  '23514', null, 'até 8 KB');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.notes where tags @> '{favorito}'), 0, 'estranho não acha pela etiqueta');
update public.notes set props = '{"nota": 0}';

-- Leitor de um projeto lê as propriedades, mas não muda
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.notes (id, title, folder_id, props) values
  ('dddddddd-0000-0000-0000-000000000002', 'Da pasta', 'aaaaaaaa-0000-0000-0000-000000000001', '{"status": "aberto"}');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select props ->> 'status' from public.notes where id = 'dddddddd-0000-0000-0000-000000000002'), 'aberto', 'leitor lê');
update public.notes set props = '{"status": "fechado"}' where id = 'dddddddd-0000-0000-0000-000000000002';
reset role;
select is((select props ->> 'status' from public.notes where id = 'dddddddd-0000-0000-0000-000000000002'), 'aberto', 'leitor não muda');
select is((select (props ->> 'nota')::int from public.notes where id = 'dddddddd-0000-0000-0000-000000000001'), 4,
  'estranho não muda');

select * from finish();
rollback;
