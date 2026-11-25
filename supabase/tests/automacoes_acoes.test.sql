-- ESCOPO_V14 (AU4): as ações do motor, aplicadas pelo banco como a dona da regra.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
delete from public.automation_runs;
delete from public.automation_events;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'gerente@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'fora@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A fazer'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Depois');
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pagar a luz');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'manager');
set local role authenticated;
insert into public.automation_rules (id, scope, folder_id, name, definition) values
  ('d0000000-0000-0000-0000-000000000001', 'projeto', 'aaaaaaaa-0000-0000-0000-000000000001', 'Da dona',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}'),
  ('d0000000-0000-0000-0000-000000000002', 'projeto', 'aaaaaaaa-0000-0000-0000-000000000001', 'Chamada',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}');
insert into public.automation_rules (id, scope, name, definition) values
  ('d0000000-0000-0000-0000-000000000003', 'pessoal', 'Pessoal',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.automation_rules (id, scope, folder_id, name, definition) values
  ('d0000000-0000-0000-0000-000000000004', 'projeto', 'aaaaaaaa-0000-0000-0000-000000000001', 'Do gerente',
   '{"v": 1, "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}');
reset role;

-- Um passo de uma execução nova da regra, com o evento e o efeito dados
create function pg_temp.passo(p_rule uuid, p_evento jsonb, p_efeito jsonb)
returns text language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.automation_runs (rule_id, event_id, status, claimed_at, state)
  values (p_rule, gen_random_uuid(), 'rodando', '2026-01-01', jsonb_build_object('evento', p_evento, 'var', '{}'::jsonb))
  returning id into v_id;
  return public.automation_step(v_id, '2026-01-01', 0, 1, jsonb_build_object('evento', p_evento, 'var', '{}'::jsonb),
    p_efeito, '{"caminho": "0"}', '[]', 'ok');
end;
$$;
create function pg_temp.ultimo_resultado() returns jsonb language sql as $$
  select steps -> 0 -> 'resultado' from public.automation_runs order by started_at desc, ctid desc limit 1 $$;

-- Criar tarefa: na lista do evento, criada pela dona
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"lista": "bbbbbbbb-0000-0000-0000-000000000001"}',
  '{"tipo": "criar_tarefa", "titulo": "Conferir o boleto", "vencimento": "2026-12-01", "etiquetas": ["casa"]}'), 'ok', 'criar tarefa');
select is((select created_by::text || '|' || due_date || '|' || labels[1] from public.tasks where title = 'Conferir o boleto'),
  '11111111-1111-1111-1111-111111111111|2026-12-01|casa', 'como a dona, com vencimento e etiqueta');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"lista": "bbbbbbbb-0000-0000-0000-000000000001"}',
  '{"tipo": "criar_tarefa", "titulo": "conferir o boleto", "evitar_duplicar": true}'), 'ok', 'evitar duplicar roda');
select is((select count(*)::int from public.tasks where lower(title) = 'conferir o boleto'), 1, 'e não cria outra igual');
select is(pg_temp.ultimo_resultado() ->> 'duplicada', 'true', 'o histórico diz que já existia');

-- Atualizar: etiqueta, lista e vencimento; o resto do efeito é ignorado (V14-5)
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"tarefa": "c0000000-0000-0000-0000-000000000001"}',
  '{"tipo": "atualizar_tarefa", "adicionar_etiquetas": ["#Urgente"], "mover_para": "bbbbbbbb-0000-0000-0000-000000000002",
    "vencimento": "2026-12-10", "status": "done", "concluir": true, "apagar": true, "completed_at": "2026-01-01"}'), 'ok',
  'atualizar tarefa');
select is((select page_id::text || '|' || labels[1] || '|' || due_date || '|' || status from public.tasks
  where id = 'c0000000-0000-0000-0000-000000000001'),
  'bbbbbbbb-0000-0000-0000-000000000002|urgente|2026-12-10|todo', 'mudou o que pode e continua aberta');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"tarefa": "c0000000-0000-0000-0000-000000000001"}',
  '{"tipo": "concluir_tarefa"}'), 'falhou', 'definição manipulada: concluir não existe');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"tarefa": "c0000000-0000-0000-0000-000000000001"}',
  '{"tipo": "apagar_tarefa"}'), 'falhou', 'nem apagar');
select ok(exists (select 1 from public.tasks where id = 'c0000000-0000-0000-0000-000000000001' and status <> 'done'),
  'a tarefa segue lá, aberta');

-- Atribuir: só gente do projeto
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"tarefa": "c0000000-0000-0000-0000-000000000001"}',
  '{"tipo": "atribuir", "pessoa": "22222222-2222-2222-2222-222222222222"}'), 'ok', 'atribuir a quem é do projeto');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{"tarefa": "c0000000-0000-0000-0000-000000000001"}',
  '{"tipo": "atribuir", "pessoa": "33333333-3333-3333-3333-333333333333"}'), 'falhou', 'e não a quem é de fora');

-- Executar outra regra: vira evento com a cadeia; voltar para quem chamou é recusado
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000001', '{}',
  '{"tipo": "executar_regra", "regra": "d0000000-0000-0000-0000-000000000002"}'), 'ok', 'executar outra regra');
select is((select payload -> '_cadeia' ->> 0 from public.automation_events where payload ->> 'regra' = 'd0000000-0000-0000-0000-000000000002'),
  'd0000000-0000-0000-0000-000000000001', 'o evento leva quem chamou');
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000002', '{"_cadeia": ["d0000000-0000-0000-0000-000000000001"]}',
  '{"tipo": "executar_regra", "regra": "d0000000-0000-0000-0000-000000000001"}'), 'falhou', 'A chama B chama A é recusado na execução');

-- Modo jogo é preferência da dona
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000003', '{}', '{"tipo": "alternar_modo_jogo", "modo": "off"}'), 'ok',
  'trocar o modo jogo');
select is((select gamification_enabled from public.profiles where id = '11111111-1111-1111-1111-111111111111'), false,
  'o jogo ficou desligado');

-- Quem criou a regra perdeu o cargo: a ação falha
update public.folder_members set role = 'viewer' where user_id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.passo('d0000000-0000-0000-0000-000000000004', '{"lista": "bbbbbbbb-0000-0000-0000-000000000001"}',
  '{"tipo": "criar_tarefa", "titulo": "Do leitor"}'), 'falhou', 'regra de quem virou leitor não cria tarefa');

-- Tarefa criada por automação dá XP ao ser concluída, como qualquer outra (D333)
update public.profiles set gamification_enabled = true where id = '11111111-1111-1111-1111-111111111111';
update public.tasks set created_at = now() - interval '2 hours' where title = 'Conferir o boleto';
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task((select id from public.tasks where title = 'Conferir o boleto'));
reset role;
select ok((select sum(amount) from public.xp_events where user_id = '11111111-1111-1111-1111-111111111111'
  and task_id = (select id from public.tasks where title = 'Conferir o boleto')) > 0, 'concluir dá XP (D333)');

select * from finish();
rollback;
