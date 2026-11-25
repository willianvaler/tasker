-- ESCOPO_V16 (PR4): o motor dos processos no banco (reivindicar, avançar, juntar, esperar, limites).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000001', 'Paralelo',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "p", "tipo": "and"}, {"id": "a", "tipo": "fim"},
     {"id": "j", "tipo": "and"}, {"id": "t", "tipo": "temporizador", "duracao": "PT1H"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "1", "de": "i", "para": "p"}, {"id": "2", "de": "p", "para": "j"}, {"id": "3", "de": "p", "para": "j"},
                {"id": "4", "de": "p", "para": "j"}, {"id": "5", "de": "j", "para": "t"}, {"id": "6", "de": "t", "para": "f"},
                {"id": "7", "de": "i", "para": "a"}]}');
select public.process_publish('d0000000-0000-0000-0000-000000000001');
create temp table inst as select public.process_start('d0000000-0000-0000-0000-000000000001') as id;
reset role;

create function pg_temp.claim() returns setof jsonb language sql as $$ select jsonb_array_elements(public.process_claim(50)) $$;
create function pg_temp.avancar(p jsonb, d jsonb) returns text language sql as $$
  select public.process_advance((p ->> 'token')::uuid, (p ->> 'claimed_at')::timestamptz, d) $$;

-- Início: um token pronto, reivindicado uma vez
create temp table c1 as select * from pg_temp.claim() x;
select is((select count(*)::int from c1), 1, 'o token do início é reivindicado');
select is((select count(*)::int from pg_temp.claim()), 0, 'e não de novo enquanto roda');
select is(pg_temp.avancar((select x from c1 x), '{"tipo": "seguir", "proximos": [{"no": "p"}]}'), 'ok', 'avança');
select is(pg_temp.avancar((select x from c1 x), '{"tipo": "seguir", "proximos": [{"no": "p"}]}'), 'ignorado',
  'o mesmo passo de novo é ignorado (não repete)');

-- Paralelo de três: só segue depois de os três chegarem
create temp table c2 as select * from pg_temp.claim() x;
do $$ begin perform pg_temp.avancar((select x from c2 x), '{"tipo": "seguir", "proximos": [{"no": "j"}, {"no": "j"}, {"no": "j"}]}'); end $$;
create temp table c3 as select * from pg_temp.claim() x;
select is((select count(*)::int from c3), 3, 'três tokens na junção');
do $$ begin perform pg_temp.avancar(x, '{"tipo": "juntar", "esperados": 3, "seguir": [{"no": "t"}]}') from (select x from c3 x limit 2) y; end $$;
select is((select count(*)::int from public.process_tokens where instance_id = (select id from inst) and node_id = 't'), 0,
  'com dois, ainda não segue');
do $$ begin perform pg_temp.avancar(x, '{"tipo": "juntar", "esperados": 3, "seguir": [{"no": "t"}]}') from (select x from c3 x offset 2) y; end $$;
select is((select count(*)::int from public.process_tokens where instance_id = (select id from inst) and node_id = 't'), 1,
  'com o terceiro, segue um só');

-- Temporizador: espera no banco e o varredor solta no vencimento
create temp table c4 as select * from pg_temp.claim() x;
do $$ begin perform pg_temp.avancar((select x from c4 x), jsonb_build_object('tipo', 'esperar', 'espera',
  jsonb_build_object('tipo', 'temporizador', 'ate', now() + interval '1 hour'))); end $$;
select is((select count(*)::int from pg_temp.claim()), 0, 'esperando não é reivindicado');
update public.process_waits set due_at = now() - interval '1 second' where instance_id = (select id from inst);
select public._process_sweep();
create temp table c5 as select * from pg_temp.claim() x;
select is((select x ->> 'node' from c5 x), 't', 'no vencimento, o varredor solta o token');
do $$ begin perform pg_temp.avancar((select x from c5 x), '{"tipo": "seguir", "proximos": [{"no": "f"}]}'); end $$;
create temp table c6 as select * from pg_temp.claim() x;
do $$ begin perform pg_temp.avancar((select x from c6 x), '{"tipo": "fim"}'); end $$;
select is((select status from public.process_instances where id = (select id from inst)), 'concluida', 'chega ao fim e conclui');
select is((select count(*)::int from public.process_steps where instance_id = (select id from inst)), 6,
  'cada passo ficou no histórico');

-- Limite de 2.000 passos
set local role authenticated;
create temp table inst2 as select public.process_start('d0000000-0000-0000-0000-000000000001') as id;
reset role;
update public.process_instances set steps_count = 2000 where id = (select id from inst2);
create temp table c7 as select * from pg_temp.claim() x;
do $$ begin perform pg_temp.avancar((select x from c7 x), '{"tipo": "seguir", "proximos": [{"no": "p"}]}'); end $$;
select is((select status || ':' || error from public.process_instances where id = (select id from inst2)),
  'falhou:Passou de 2.000 passos', 'passou de 2.000 passos: falha com o motivo');

-- Falha sem caminho de erro: o token fica para "repetir passo com falha"
set local role authenticated;
create temp table inst3 as select public.process_start('d0000000-0000-0000-0000-000000000001') as id;
reset role;
create temp table c8 as select * from pg_temp.claim() x;
do $$ begin perform pg_temp.avancar((select x from c8 x), '{"tipo": "falha", "erro": "Deu errado"}'); end $$;
select is((select status from public.process_instances where id = (select id from inst3)), 'falhou', 'falha sem caminho de erro');
set local role authenticated;
select public.process_resume((select id from inst3));
reset role;
select is((select count(*)::int from pg_temp.claim()), 1, 'retomar põe o passo para rodar de novo');

-- Pausar todas: nada é reivindicado
update public.process_tokens set status = 'pronto', claimed_at = null where instance_id = (select id from inst3);
update public.profiles set automations_paused = true where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from pg_temp.claim()), 0, 'pausado: nada roda');
update public.profiles set automations_paused = false where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from pg_temp.claim()), 1, 'volta a rodar ao tirar a pausa');

select * from finish();
rollback;
