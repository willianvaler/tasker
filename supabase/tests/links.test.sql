-- OB1 (D286): links [[...]] nas anotações e nas tarefas viram linhas de `links` por trigger. A dona
-- vê os da anotação pessoal; quem é da pasta vê os da pasta; estranho não vê; ninguém grava direto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Mercado');
insert into public.notes (id, title, body) values
  ('e0000000-0000-0000-0000-000000000001', 'Ideias', 'Nada aqui');
insert into public.notes (id, title, body) values
  ('e0000000-0000-0000-0000-000000000002', 'Diário',
   E'# Hoje\n- [ ] ver [[Ideias|n:e0000000-0000-0000-0000-000000000001]] e [[Mercado#Frutas|p:bbbbbbbb-0000-0000-0000-000000000001]]\n'
   || E'Escrever [[Nova ideia]] e [[Outra|apelido]]\n![[Ideias|n:e0000000-0000-0000-0000-000000000001]]\n`[[` sozinho não conta');

select is((select count(*)::int from public.links where source_id = 'e0000000-0000-0000-0000-000000000002'), 5,
  'cinco links na anotação');
select is((select context from public.links where source_id = 'e0000000-0000-0000-0000-000000000002' and position = 1),
  'ver Ideias e Mercado', 'a frase em volta, sem a marcação nem a caixinha');
select is((select target_kind || ':' || coalesce(anchor, '') from public.links
           where source_id = 'e0000000-0000-0000-0000-000000000002' and position = 2),
  'page:Frutas', 'link para a lista, com a âncora');
select is((select count(*)::int from public.links where target_id is null and target_title in ('Nova ideia', 'Outra')), 2,
  'o que ainda não existe fica pelo título (e o apelido não é id)');
select is((select embed from public.links where source_id = 'e0000000-0000-0000-0000-000000000002' and position = 5), true,
  '![[...]] é incorporar');
select is((select count(*)::int from public.links where target_id = 'e0000000-0000-0000-0000-000000000001'), 2,
  'backlinks da anotação Ideias pela tabela');

update public.notes set body = 'só [[Ideias|n:e0000000-0000-0000-0000-000000000001]]'
  where id = 'e0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.links where source_id = 'e0000000-0000-0000-0000-000000000002'), 1,
  'editar refaz os links');
update public.notes set title = 'Diário 2' where id = 'e0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.links where source_id = 'e0000000-0000-0000-0000-000000000002'), 1,
  'mudar só o título não mexe');

-- Tarefa do projeto com link na descrição
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Comprar');
update public.tasks set notes = 'veja [[Ideias|n:e0000000-0000-0000-0000-000000000001]]'
  where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select folder_id from public.links where source_kind = 'task'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'o link da tarefa leva a pasta dela');
select throws_ok($$ insert into public.links (source_kind, source_id, user_id, target_title)
  values ('note', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x') $$,
  '42501', null, 'ninguém grava em links direto');
select throws_ok($$ select public._refresh_links('note', 'e0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111', null, '[[x]]') $$,
  '42501', null, 'nem chama a função do trigger');

reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.links), 1, 'o leitor do projeto vê o link da tarefa, não os da anotação pessoal');
select is((select count(*)::int from public.links where target_id = 'e0000000-0000-0000-0000-000000000001'), 1,
  'backlink pela tarefa (a anotação de destino ele não vê, o app mostra "sem acesso")');
select throws_ok($$ update public.links set context = 'x' $$, '42501', null, 'o leitor não altera');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.links), 0, 'estranho não vê nenhum');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.tasks set notes = 'sem link' where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.links where source_kind = 'task'), 0, 'tirar o link da descrição tira a linha');
update public.tasks set notes = '[[Diário 2|n:e0000000-0000-0000-0000-000000000002]]'
  where id = 'cccccccc-0000-0000-0000-000000000001';
delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.links where source_kind = 'task'), 0, 'tarefa apagada leva os links');
delete from public.notes where id = 'e0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.links), 0, 'anotação apagada leva os links');

select is(public._link_context('> [!dica] leia [[A#b|n:e0000000-0000-0000-0000-000000000001]] já'), '[!dica] leia A já',
  'contexto de uma citação');
select is(public._link_context('1. [[Só]]'), 'Só', 'contexto de lista numerada');

select * from finish();
rollback;
