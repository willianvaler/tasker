-- ESCOPO_V14 (AU6): limites por regra e por pessoa, intervalo de espera, avisos por hora, desligar
-- depois de falhas seguidas e Pausar todas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
delete from public.automation_runs;
delete from public.automation_events;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'pessoal', 'Muito usada',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}'),
  ('d0000000-0000-0000-0000-000000000002', 'pessoal', 'Com intervalo',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}], "limites": {"cooldown_min": 30}}'),
  ('d0000000-0000-0000-0000-000000000003', 'pessoal', 'Avisa',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "notificar", "corpo": "x"}]}');
reset role;

create function pg_temp.disparar(p_rule uuid) returns text language plpgsql as $$
begin
  insert into public.automation_events (owner_id, kind, payload)
  values ('11111111-1111-1111-1111-111111111111', 'manual', jsonb_build_object('regra', p_rule));
  perform public.automation_claim(50);
  return (select status from public.automation_runs where rule_id = p_rule order by started_at desc, ctid desc limit 1);
end $$;
create function pg_temp.passo(p_rule uuid, p_efeito jsonb) returns text language plpgsql as $$
declare v_id uuid;
begin
  insert into public.automation_runs (rule_id, event_id, status, claimed_at, state)
  values (p_rule, gen_random_uuid(), 'rodando', '2026-01-01', '{"evento": {}, "var": {}}') returning id into v_id;
  perform public.automation_step(v_id, '2026-01-01', 0, 1, '{"evento": {}, "var": {}}', p_efeito, '{"caminho": "0"}', '[]', 'ok');
  return (select status from public.automation_runs where id = v_id);
end $$;

-- 60 por hora na regra: a 61ª nasce limitada, sem erro
insert into public.automation_runs (rule_id, event_id, status, started_at)
select 'd0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'ok', now() - interval '10 minutes' from generate_series(1, 60);
select is(pg_temp.disparar('d0000000-0000-0000-0000-000000000001'), 'limitada', 'a 61ª execução da hora fica limitada');
select is((select error from public.automation_runs where status = 'limitada'), 'Limite de 60 execuções por hora desta automação',
  'com o motivo');
select is((select consecutive_failures from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000001'), 0,
  'limitada não conta como falha');

-- Intervalo de espera (cooldown) da regra
select is(pg_temp.disparar('d0000000-0000-0000-0000-000000000002'), 'rodando', 'a primeira roda');
select is(pg_temp.disparar('d0000000-0000-0000-0000-000000000002'), 'limitada', 'a segunda, dentro dos 30 min, não');

-- Por pessoa (o limite vem do app_config; aqui, 61: as 60 de antes mais a do intervalo)
insert into public.app_config values ('automation_limit_owner_hour', '61');
select is(pg_temp.disparar('d0000000-0000-0000-0000-000000000003'), 'limitada', 'passou do limite da pessoa na hora');
delete from public.app_config where key = 'automation_limit_owner_hour';

-- Avisos: até N por hora por regra (aqui, 1)
insert into public.app_config values ('automation_limit_notify_hour', '1');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000003', '{"tipo": "notificacao", "corpo": "x", "para": "dona"}'), 'ok',
  'o primeiro aviso sai');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000003', '{"tipo": "notificacao", "corpo": "x", "para": "dona"}'), 'limitada',
  'o segundo na mesma hora fica limitado');
delete from public.app_config where key = 'automation_limit_notify_hour';

-- 10 falhas seguidas desligam e avisam uma vez
update public.automation_rules set consecutive_failures = 9 where id = 'd0000000-0000-0000-0000-000000000003';
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000003', '{"tipo": "rodar_js"}'), 'falhou', 'a décima falha');
select is((select enabled::text || '|' || disabled_reason from public.automation_rules where id = 'd0000000-0000-0000-0000-000000000003'),
  'false|falhas', 'desliga a regra');
select is((select count(*)::int from public.notifications where payload ->> 'titulo' = 'Automação desligada'), 1, 'e avisa a dona');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000003', '{"tipo": "notificacao", "corpo": "x"}'), 'cancelada',
  'desligada, o que estava rodando para');
select is((select count(*)::int from public.notifications where payload ->> 'titulo' = 'Automação desligada'), 1, 'avisou uma vez só');
set local role authenticated;
update public.automation_rules set enabled = true where id = 'd0000000-0000-0000-0000-000000000003';
reset role;
select is((select consecutive_failures::text || '|' || coalesce(disabled_reason, '-') from public.automation_rules
  where id = 'd0000000-0000-0000-0000-000000000003'), '0|-', 'religar zera as falhas');

-- Pausar todas: cancela o que espera, nada novo roda, e o que está no meio para
insert into public.automation_runs (id, rule_id, event_id, status, resume_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', gen_random_uuid(), 'esperando', now() + interval '1 hour');
set local role authenticated;
select public.set_automations_paused(true);
select is((public.automation_usage() ->> 'pausado'), 'true', 'o uso mostra pausado');
reset role;
select is((select status from public.automation_runs where id = 'e0000000-0000-0000-0000-000000000001'), 'cancelada',
  'a execução em espera foi cancelada');
insert into public.automation_events (owner_id, kind, payload)
values ('11111111-1111-1111-1111-111111111111', 'manual', '{"regra": "d0000000-0000-0000-0000-000000000003"}');
select is((select count(*)::int from jsonb_array_elements(public.automation_claim(50)) x
  where x ->> 'rule_id' = 'd0000000-0000-0000-0000-000000000003'), 0, 'pausada, evento novo não vira execução');

select * from finish();
rollback;
