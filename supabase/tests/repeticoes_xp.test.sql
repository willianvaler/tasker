-- V3 §4.1 (J6): XP das repetições só na conclusão final, pelo servidor, sem duplicar ao desfazer e
-- refazer, nem ao reenviar a fila. now() é fixo na transação: o created_at é recuado (relâmpago).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rotina');
insert into public.tasks (id, page_id, title, repeat_plan) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Flexões',
   '{"mode": "sets", "total": 3}');
reset role;
update public.tasks set created_at = now() - interval '1 hour';
update public.pages set created_at = now() - interval '1 hour';
set local role authenticated;

create function pg_temp.my_xp() returns int language sql as
  $$ select xp from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$;

select public.log_rep('cccccccc-0000-0000-0000-000000000001', 1);
select public.log_rep('cccccccc-0000-0000-0000-000000000001', 1);
select is(pg_temp.my_xp(), 0, 'séries do meio não dão XP');
select is((select count(*)::int from public.xp_events where task_id = 'cccccccc-0000-0000-0000-000000000001'), 0,
  'nem entram no ledger');

select is((public.log_rep('cccccccc-0000-0000-0000-000000000001', 1) ->> 'xp')::int, 10,
  'a última série conclui com o XP da tarefa');
select is(pg_temp.my_xp(), 10, 'perfil soma o XP');
select is((public.log_rep('cccccccc-0000-0000-0000-000000000001', 1) ->> 'done_reps')::int, 3,
  'série a mais numa concluída não muda nada');
select is(pg_temp.my_xp(), 10, 'nem dá XP de novo');

-- Desfazer a última devolve o XP; refazer várias vezes vale uma conclusão
select public.log_rep('cccccccc-0000-0000-0000-000000000001', -1);
select is(pg_temp.my_xp(), 0, 'desfazer a última devolve o XP');
select public.log_rep('cccccccc-0000-0000-0000-000000000001', 1);
select public.log_rep('cccccccc-0000-0000-0000-000000000001', -1);
select public.log_rep('cccccccc-0000-0000-0000-000000000001', 1);
select is(pg_temp.my_xp(), 10, 'desfazer e refazer = uma conclusão');

-- Reenvio da fila (mesma chave) não conta outra série
select public.log_rep('cccccccc-0000-0000-0000-000000000001', -1);
select public.run_once('dddddddd-0000-0000-0000-000000000001', 'log_rep',
  '{"p_task_id": "cccccccc-0000-0000-0000-000000000001", "p_delta": 1}');
select is((public.run_once('dddddddd-0000-0000-0000-000000000001', 'log_rep',
  '{"p_task_id": "cccccccc-0000-0000-0000-000000000001", "p_delta": 1}') ->> 'duplicate')::boolean, true,
  'o mesmo comando reenviado é ignorado');
select is(pg_temp.my_xp(), 10, 'e o XP fica o de uma conclusão');

select * from finish();
rollback;
