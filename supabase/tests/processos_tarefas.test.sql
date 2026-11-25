-- ESCOPO_V16 (PR6): tarefas humanas dos processos (formulário, escolha, prazo, delegar, saída, XP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'membro@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Compras', 'project');
insert into public.pages (id, folder_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pedidos');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
set local role authenticated;
insert into public.process_definitions (id, name, draft) values ('d0000000-0000-0000-0000-000000000001', 'Aprovação',
  '{"v": 1, "nos": [{"id": "i", "tipo": "inicio"}, {"id": "h", "tipo": "humana", "titulo": "Aprovar compra"}, {"id": "f", "tipo": "fim"}],
    "arestas": [{"id": "1", "de": "i", "para": "h"}, {"id": "2", "de": "h", "para": "f"}]}');
select public.process_publish('d0000000-0000-0000-0000-000000000001');
reset role;

create function pg_temp.claim() returns setof jsonb language sql as $$ select jsonb_array_elements(public.process_claim(50)) $$;
-- Inicia e leva o token até a tarefa humana (o que o executor faria)
create function pg_temp.ate_humana(p_espera jsonb) returns uuid language plpgsql as $$
declare v_inst uuid; c jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
  v_inst := public.process_start('d0000000-0000-0000-0000-000000000001');
  select x into c from pg_temp.claim() x where x ->> 'instance' = v_inst::text;
  perform public.process_advance((c ->> 'token')::uuid, (c ->> 'claimed_at')::timestamptz, '{"tipo": "seguir", "proximos": [{"no": "h"}]}');
  select x into c from pg_temp.claim() x where x ->> 'instance' = v_inst::text;
  perform public.process_advance((c ->> 'token')::uuid, (c ->> 'claimed_at')::timestamptz, jsonb_build_object('tipo', 'esperar', 'espera', p_espera));
  return v_inst;
end $$;
create function pg_temp.tarefa(p_inst uuid) returns uuid language sql as $$
  select task_id from public.process_waits where instance_id = p_inst and kind = 'humana' $$;

create temp table a as select pg_temp.ate_humana(jsonb_build_object('tipo', 'humana', 'titulo', 'Aprovar compra',
  'pessoa', '22222222-2222-2222-2222-222222222222', 'lista', 'bbbbbbbb-0000-0000-0000-000000000001',
  'escolhas', jsonb_build_array('Aprovar', 'Rejeitar'),
  'formulario', jsonb_build_array(jsonb_build_object('nome', 'motivo', 'rotulo', 'Motivo', 'tipo', 'texto', 'obrigatorio', true))))
  as id;
create temp table ta as select pg_temp.tarefa(id) as t from a;
grant select on a, ta to authenticated;
select is((select meta #>> '{processo,instancia}' from public.tasks where id = (select t from ta)),
  (select id::text from a), 'a tarefa é normal, ligada ao processo');
select is((select user_id::text from public.task_assignees where task_id = (select t from ta)),
  '22222222-2222-2222-2222-222222222222', 'atribuída a quem o nó pede');

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(format($$ select public.complete_task(%L) $$, (select t from ta)), '22023', null,
  'a caixinha sozinha não conclui tarefa com resposta');
select throws_ok(format($$ select public.process_complete_task(%L, 'Rejeitar', '{}') $$, (select t from ta)),
  '22023', 'Campo obrigatório: Motivo', 'o servidor recusa campo obrigatório vazio');
select throws_ok(format($$ select public.process_complete_task(%L, 'Talvez', '{"motivo": "x"}') $$, (select t from ta)),
  '22023', 'Escolha uma das opções', 'e escolha que não existe');
select lives_ok(format($$ select public.process_complete_task(%L, 'Rejeitar', '{"motivo": "caro"}') $$, (select t from ta)),
  'responder conclui');
reset role;
select is((select result ->> 'escolha' from public.process_tokens where instance_id = (select id from a) and node_id = 'h'),
  'Rejeitar', 'o processo segue com a escolha');
select is((select result #>> '{formulario,motivo}' from public.process_tokens where instance_id = (select id from a) and node_id = 'h'),
  'caro', 'e com o formulário');
select is((select count(*)::int from public.xp_events where task_id = (select t from ta)), 0,
  'tarefa de processo não rende XP por padrão');

-- Delegar e sair do projeto
create temp table b as select pg_temp.ate_humana(jsonb_build_object('tipo', 'humana', 'titulo', 'Conferir',
  'pessoa', '22222222-2222-2222-2222-222222222222', 'lista', 'bbbbbbbb-0000-0000-0000-000000000001')) as id;
create temp table tb as select pg_temp.tarefa(id) as t from b;
grant select on b, tb to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.process_delegate((select t from tb), '11111111-1111-1111-1111-111111111111');
reset role;
select ok(exists (select 1 from public.process_steps where instance_id = (select id from b) and result ? 'delegou'),
  'delegar fica no histórico');
select is((select user_id::text from public.task_assignees where task_id = (select t from tb)),
  '11111111-1111-1111-1111-111111111111', 'e a tarefa muda de pessoa');
create temp table c as select pg_temp.ate_humana(jsonb_build_object('tipo', 'humana', 'titulo', 'Revisar',
  'pessoa', '22222222-2222-2222-2222-222222222222', 'lista', 'bbbbbbbb-0000-0000-0000-000000000001')) as id;
delete from public.folder_members where user_id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.task_assignees where task_id = pg_temp.tarefa((select id from c))), 0,
  'quem saiu do projeto: a tarefa volta ao grupo');
select ok(exists (select 1 from public.process_steps where instance_id = (select id from c) and result ? 'saiu_do_projeto'),
  'e o histórico registra');

-- Prazo: lembrete uma vez e o caminho do prazo
update public.process_waits set remind_at = now() - interval '1 minute' where instance_id = (select id from c);
select public._process_sweep();
select public._process_sweep();
select is((select count(*)::int from public.notifications where payload ->> 'processo' = (select id::text from c)), 1,
  'lembra uma vez antes do prazo');
update public.process_waits set due_at = now() - interval '1 minute' where instance_id = (select id from c);
select public._process_sweep();
select is((select result ->> 'prazo' from public.process_tokens where instance_id = (select id from c) and node_id = 'h'),
  'true', 'prazo vencido segue pelo caminho do prazo');

select * from finish();
rollback;
