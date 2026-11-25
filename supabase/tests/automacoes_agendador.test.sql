-- ESCOPO_V14 (AU5): agendador, prazos por marca d'água, perdido, esperar, novas tentativas e anti-laço.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);
delete from public.automation_runs;
delete from public.automation_events;
delete from public.automation_scan_state;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo' where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Ar às 19h',
   '{"v": 1, "gatilho": {"tipo": "horario", "hora": "19:00"}, "passos": [{"tipo": "notificar", "corpo": "x"}]}'),
  ('d0000000-0000-0000-0000-000000000002', 'pessoal', 'Segunda',
   '{"v": 1, "gatilho": {"tipo": "horario", "hora": "07:30", "dias": ["1"]}, "passos": [{"tipo": "parar"}]}'),
  ('d0000000-0000-0000-0000-000000000003', 'pessoal', 'A cada 2 h',
   '{"v": 1, "gatilho": {"tipo": "intervalo", "horas": 2}, "passos": [{"tipo": "parar"}]}');
reset role;

-- Próximo disparo no fuso da dona
select is((select (next_run_at at time zone 'America/Sao_Paulo')::time from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000001'), '19:00'::time, 'horário: 19:00 no fuso da dona');
select ok((select next_run_at > now() and next_run_at <= now() + interval '1 day' from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000001'), 'nas próximas 24 h');
select is((select extract(dow from next_run_at at time zone 'America/Sao_Paulo')::integer from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000002'), 1, 'só nos dias pedidos (segunda)');
select is((select next_run_at from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000003'),
  now() + interval '2 hours', 'intervalo: daqui a 2 h');
update public.automation_rules set enabled = false where id = 'd0000000-0000-0000-0000-000000000002';
select is((select next_run_at from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000002'), null,
  'desligada não tem próximo disparo');
update public.profiles set timezone = 'Europe/Lisbon' where id = '11111111-1111-1111-1111-111111111111';
select is((select (next_run_at at time zone 'Europe/Lisbon')::time from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000001'), '19:00'::time, 'mudou o fuso: 19:00 no fuso novo');
update public.profiles set timezone = 'America/Sao_Paulo' where id = '11111111-1111-1111-1111-111111111111';

-- Na hora: um evento, e o próximo fica para amanhã
update public.automation_rules set next_run_at = now() - interval '30 seconds' where id = 'd0000000-0000-0000-0000-000000000001';
select is(public._automation_schedule(), 1, 'o agendador pega a regra na hora');
select is((select count(*)::int from public.automation_events where kind = 'horario'), 1, 'e grava um evento');
select ok((select next_run_at > now() from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'),
  'o próximo disparo andou');
select is((select count(*)::int from jsonb_array_elements(public.automation_claim(20))), 1, 'a execução sai');

-- Servidor parado 20 min (o limite é 15): perdido, sem rodar
update public.automation_rules set next_run_at = now() - interval '20 minutes' where id = 'd0000000-0000-0000-0000-000000000001';
select public._automation_schedule();
select is(jsonb_array_length(public.automation_claim(20)), 0, 'atrasado demais não é reivindicado');
select is((select status from public.automation_runs where status = 'perdido'), 'perdido', 'fica como perdido');
select ok((select error like 'Atrasou 20 min%' from public.automation_runs where status = 'perdido'), 'dizendo quanto atrasou');

-- Intervalo atrasado pula o que ficou para trás
update public.automation_rules set next_run_at = now() - interval '5 hours 1 minute' where id = 'd0000000-0000-0000-0000-000000000003';
select public._automation_schedule();
select is((select next_run_at from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000003'),
  now() + interval '59 minutes', 'intervalo continua na série, no futuro');

-- Prazos: atrasada e vencendo, uma vez por tarefa
set local role authenticated;
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'L');
insert into public.tasks (id, page_id, title, due_date, due_time)
select 'c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pagar a luz',
       (t)::date, (t)::time(0) from (select (now() - interval '5 minutes') at time zone 'America/Sao_Paulo' as t) x;
insert into public.tasks (id, page_id, title, due_date, due_time)
select 'c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Reunião',
       (t)::date, (t)::time(0) from (select (now() + interval '55 minutes') at time zone 'America/Sao_Paulo' as t) x;
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000004', 'pessoal', 'Atrasou',
   '{"v": 1, "gatilho": {"tipo": "tarefa.atrasada"}, "passos": [{"tipo": "notificar", "corpo": "{{evento.titulo}}"}]}'),
  ('d0000000-0000-0000-0000-000000000005', 'pessoal', 'Falta 1 h',
   '{"v": 1, "gatilho": {"tipo": "tarefa.vencendo", "minutos": 60}, "passos": [{"tipo": "notificar", "corpo": "x"}]}');
reset role;
select is(public._automation_scan_due(), 0, 'a primeira varredura só marca a hora');
update public.automation_scan_state set last_scan_at = now() - interval '10 minutes';
select is(public._automation_scan_due(), 2, 'atrasada e vencendo na janela');
select is((select payload ->> 'titulo' from public.automation_events where kind = 'tarefa.atrasada'), 'Pagar a luz',
  'atrasada com a tarefa');
select is((select payload ->> 'titulo' from public.automation_events where kind = 'tarefa.vencendo'), 'Reunião',
  'vencendo com a tarefa');
update public.automation_scan_state set last_scan_at = now() - interval '10 minutes';
select public._automation_scan_due();
select is((select count(*)::int from public.automation_events where kind = 'tarefa.atrasada'), 1, 'atrasada dispara uma vez por tarefa');

-- Esperar: fica no banco e volta na hora
delete from public.automation_runs;
update public.automation_events set processed_at = now();
insert into public.automation_runs (id, rule_id, event_id, status, claimed_at, state, definition) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'rodando', '2026-01-01',
   '{"evento": {}, "var": {}}', '{"passos": [{"tipo": "esperar", "minutos": 60}, {"tipo": "parar"}]}');
select is(public.automation_step('e0000000-0000-0000-0000-000000000001', '2026-01-01', 0, 1, '{"evento": {}, "var": {}}',
  null, null, '[]', 'esperando', null, now() + interval '1 hour'), 'ok', 'esperar grava a hora de voltar');
select is(jsonb_array_length(public.automation_claim(20)), 0, 'antes da hora, não volta (nem com o executor reiniciado)');
update public.automation_runs set resume_at = now() - interval '1 second' where id = 'e0000000-0000-0000-0000-000000000001';
select is((select (x ->> 'step')::integer from jsonb_array_elements(public.automation_claim(20)) x), 1,
  'na hora, volta no passo seguinte');

-- Erro passageiro: de novo em 1, 5 e 30 min; na quarta, falha
create function pg_temp.tentar() returns text language plpgsql as $$
declare v_claim timestamptz;
begin
  update public.automation_runs set status = 'rodando', claimed_at = '2026-01-01' where id = 'e0000000-0000-0000-0000-000000000001';
  return public.automation_step('e0000000-0000-0000-0000-000000000001', '2026-01-01', 1, 1, '{}', null, null, '[]', 'tentar', 'Rede fora');
end $$;
do $$ begin perform pg_temp.tentar(); perform pg_temp.tentar(); end $$;
select is((select status || '|' || retries || '|' || (resume_at - now()) from public.automation_runs where id = 'e0000000-0000-0000-0000-000000000001'),
  'esperando|2|00:05:00', 'segunda tentativa em 5 min');
do $$ begin perform pg_temp.tentar(); perform pg_temp.tentar(); end $$;
select is((select status from public.automation_runs where id = 'e0000000-0000-0000-0000-000000000001'), 'falhou',
  'depois de 3 tentativas, falha');

-- Anti-laço: evento de uma ação de automação leva a profundidade; da terceira em diante, nada
select set_config('questlist.automation_depth', '1', true);
create temp table emitido as select public.automation_emit('horario', '{}', '11111111-1111-1111-1111-111111111111') as id;
select is((select e.payload ->> '_profundidade' from public.automation_events e join emitido using (id)), '1',
  'o evento leva a profundidade');
select set_config('questlist.automation_depth', '3', true);
select is(public.automation_emit('horario', '{}', '11111111-1111-1111-1111-111111111111'), null,
  'na profundidade 3, não grava');
select set_config('questlist.automation_depth', '', true);

select * from finish();
rollback;
