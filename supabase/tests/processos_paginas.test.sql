-- ESCOPO_V16 (PR7): gatilhos e ações de página; processo que começa pela anotação e o anti-laço.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'outra@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Um processo que começa quando "status" vira "Estudando" e acrescenta texto na própria página
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000001', 'Estudo',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio", "gatilho": {"tipo": "pagina.propriedade_mudou", "propriedade": "status", "valor": "Estudando"}},
     {"id": "f", "tipo": "fim"}], "arestas": [{"id": "1", "de": "i", "para": "f"}]}');
select public.process_publish('d0000000-0000-0000-0000-000000000001');
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000002', 'Etiqueta',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio", "gatilho": {"tipo": "pagina.tag_adicionada", "tag": "#urgente"}},
     {"id": "f", "tipo": "fim"}], "arestas": [{"id": "1", "de": "i", "para": "f"}]}');
select public.process_publish('d0000000-0000-0000-0000-000000000002');

insert into public.notes (id, title, body) values ('c0000000-0000-0000-0000-000000000001', 'Cálculo', 'Limites');
update public.notes set props = '{"status": "Lendo"}' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000001'), 0,
  'outro valor não inicia');
update public.notes set props = '{"status": "Estudando"}' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select page_id::text from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000001'),
  'c0000000-0000-0000-0000-000000000001', 'a propriedade certa inicia o processo, ligado à página');
update public.notes set props = '{"status": "Estudando", "nota": 9}' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000001'), 1,
  'mudar outra propriedade não inicia de novo');
update public.notes set body = body || E'\n#urgente' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000002'), 1,
  'etiqueta nova inicia o da etiqueta');

-- Ações: só acrescentam ou definem
reset role;
create function pg_temp.inst() returns public.process_instances language sql as $$
  select * from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000001' $$;
select public._process_effect(pg_temp.inst(), '{"tipo": "pagina.anexar_texto", "texto": "Revisão feita"}');
select is((select body from public.notes where id = 'c0000000-0000-0000-0000-000000000001'),
  E'Limites\n#urgente\n\nRevisão feita', 'acrescenta no fim, sem tirar nada');
select public._process_effect(pg_temp.inst(), '{"tipo": "pagina.definir_propriedade", "propriedade": "status", "valor": "Estudando"}');
select public._process_effect(pg_temp.inst(), '{"tipo": "pagina.definir_propriedade", "propriedade": "status", "valor": "Revisado"}');
select is((select props ->> 'status' from public.notes where id = 'c0000000-0000-0000-0000-000000000001'), 'Revisado',
  'define a propriedade');
select is((select count(*)::int from public.process_instances where definition_id = 'd0000000-0000-0000-0000-000000000001'), 1,
  'anti-laço: a ação do processo não o inicia de novo');
select public._process_effect(pg_temp.inst(), '{"tipo": "pagina.adicionar_tag", "tag": "#feito"}');
select ok((select 'feito' = any (tags) from public.notes where id = 'c0000000-0000-0000-0000-000000000001'), 'põe a etiqueta');

-- Sem permissão: a ação não mexe em anotação de outra pessoa
insert into public.notes (id, user_id, title, body) values ('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Dela', 'x');
select throws_ok($$ select public._process_effect(pg_temp.inst(),
  '{"tipo": "pagina.anexar_texto", "texto": "y", "pagina": "c0000000-0000-0000-0000-000000000002"}') $$,
  null, 'Anotação não encontrada ou sem permissão para mudar', 'não mexe na anotação de outra pessoa');

select * from finish();
rollback;
