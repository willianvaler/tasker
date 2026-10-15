-- V3 §5.1 (K4): XP por pomodoro, pequeno, com limite diário e só para foco de verdade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create function pg_temp.focus(p_id uuid, p_minutes integer) returns void language plpgsql as $$
begin
  perform public.start_timer(p_id, 'pomodoro', now() - make_interval(mins => p_minutes + 1), p_minutes * 60,
                             null, '{"phase": "focus"}');
  perform public.update_timer(p_id, 'done');
end;
$$;
create function pg_temp.my_xp() returns int language sql as
  $$ select xp from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$;

select pg_temp.focus('a0000000-0000-0000-0000-000000000001', 25);
select is(pg_temp.my_xp(), 5, 'foco de 25 min: 5 XP');

select pg_temp.focus('a0000000-0000-0000-0000-000000000002', 10);
select is(pg_temp.my_xp(), 5, 'foco curto (10 min) registra o tempo, mas não dá XP');
select is((select count(*)::int from public.time_entries), 2, 'os dois viraram tempo');

select pg_temp.focus('a0000000-0000-0000-0000-000000000003', 25);
select pg_temp.focus('a0000000-0000-0000-0000-000000000004', 25);
select pg_temp.focus('a0000000-0000-0000-0000-000000000005', 25);
select pg_temp.focus('a0000000-0000-0000-0000-000000000006', 25);
select is(pg_temp.my_xp(), 20, 'limite do dia: 4 pomodoros com XP');

select public.delete_time_entry((select id from public.time_entries
                                 where timer_id = 'a0000000-0000-0000-0000-000000000001'));
select is(pg_temp.my_xp(), 15, 'apagar o registro do pomodoro devolve o XP');
select is((select count(*)::int from public.xp_events where kind = 'pomodoro' and not reverted), 3,
  'o evento fica revertido no ledger');

select * from finish();
rollback;
