-- ESCOPO_V16 (ED2): referência a bloco e transclusão; a origem sem permissão não vaza texto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.notes (id, title, body) values
  ('c0000000-0000-0000-0000-000000000001', 'Cálculo', E'Intro\n\nSegredo do limite ^lim1'),
  ('c0000000-0000-0000-0000-000000000002', 'Resumo',
   E'Ver ![[Cálculo#^lim1|n:c0000000-0000-0000-0000-000000000001]]\n\n[[Cálculo#^lim1|n:c0000000-0000-0000-0000-000000000001]]');
select is((select count(*)::int from public.links where source_id = 'c0000000-0000-0000-0000-000000000002'
           and target_id = 'c0000000-0000-0000-0000-000000000001' and anchor = '^lim1'), 2,
  'o link e a transclusão guardam o bloco (^id) no anchor');
select ok((select bool_or(embed) from public.links where source_id = 'c0000000-0000-0000-0000-000000000002'),
  'a transclusão é marcada como embed');

-- Bia incorpora o bloco da Ana sem ter acesso
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.notes (id, title, body) values ('c0000000-0000-0000-0000-000000000003', 'Minha',
  E'![[Cálculo#^lim1|n:c0000000-0000-0000-0000-000000000001]]');
select is((select count(*)::int from public.notes where id = 'c0000000-0000-0000-0000-000000000001'), 0,
  'sem permissão, a origem não chega (o app mostra indisponível)');
select ok(not exists (select 1 from public.links where position('Segredo' in coalesce(context, '') || coalesce(target_title, '')) > 0),
  'nenhuma linha de link que ela lê traz o texto da origem');
select is((select count(*)::int from public.links where source_id = 'c0000000-0000-0000-0000-000000000002'), 0,
  'nem os links da anotação da Ana (backlinks respeitam a RLS)');

select * from finish();
rollback;
