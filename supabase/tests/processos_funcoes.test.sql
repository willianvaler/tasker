-- ESCOPO_V16 (FN): funções chamáveis; recursão e profundidade 6 recusadas ao publicar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Uma função que chama a seguinte: f1 → f2 → … ; cada uma publicada a partir da última
create function pg_temp.chama(p_alvo uuid) returns jsonb language sql as $$
  select jsonb_build_object('v', 1, 'nos', jsonb_build_array(
    jsonb_build_object('id', 'i', 'tipo', 'inicio'),
    jsonb_build_object('id', 's', 'tipo', 'subprocesso', 'funcao', p_alvo),
    jsonb_build_object('id', 'f', 'tipo', 'fim')),
    'arestas', '[{"id": "1", "de": "i", "para": "s"}, {"id": "2", "de": "s", "para": "f"}]'::jsonb) $$;
insert into public.process_definitions (id, name, is_function, draft) values
  ('f0000000-0000-0000-0000-000000000006', 'f6', true,
   '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "f", "tipo": "fim"}], "arestas": [{"id": "1", "de": "i", "para": "f"}]}');
select public.process_publish('f0000000-0000-0000-0000-000000000006');
do $$ begin
  for k in reverse 5..1 loop
    insert into public.process_definitions (id, name, is_function, draft)
    values (('f0000000-0000-0000-0000-00000000000' || k)::uuid, 'f' || k, true,
            pg_temp.chama(('f0000000-0000-0000-0000-00000000000' || (k + 1))::uuid));
    if k > 1 then perform public.process_publish(('f0000000-0000-0000-0000-00000000000' || k)::uuid); end if;
  end loop;
end $$;
select lives_ok($$ select public.process_publish('f0000000-0000-0000-0000-000000000001') $$, 'cinco níveis (f1 chama até f6) publicam');
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000009', 'Raiz',
  pg_temp.chama('f0000000-0000-0000-0000-000000000001'));
select throws_ok($$ select public.process_publish('d0000000-0000-0000-0000-000000000009') $$, '22023',
  'No máximo 5 funções uma dentro da outra', 'a sexta função na cadeia é recusada');

-- Recursão: f6 passa a chamar f5 (que chama f6)
update public.process_definitions set draft = pg_temp.chama('f0000000-0000-0000-0000-000000000005')
where id = 'f0000000-0000-0000-0000-000000000006';
select throws_ok($$ select public.process_publish('f0000000-0000-0000-0000-000000000006') $$, '22023',
  'A função se chama (direta ou indiretamente): recursão não é permitida', 'recursão indireta é recusada');
update public.process_definitions set draft = pg_temp.chama('f0000000-0000-0000-0000-000000000006')
where id = 'f0000000-0000-0000-0000-000000000006';
select throws_ok($$ select public.process_publish('f0000000-0000-0000-0000-000000000006') $$, '22023', null,
  'e a direta também');

-- Chamar o que não é função
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000001', 'Normal',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "f", "tipo": "fim"}], "arestas": [{"id": "1", "de": "i", "para": "f"}]}');
update public.process_definitions set draft = pg_temp.chama('d0000000-0000-0000-0000-000000000001')
where id = 'f0000000-0000-0000-0000-000000000006';
select throws_ok($$ select public.process_publish('f0000000-0000-0000-0000-000000000006') $$, '22023',
  'A função chamada não existe, não é sua ou ainda não foi publicada', 'só chama função publicada');

select * from finish();
rollback;
