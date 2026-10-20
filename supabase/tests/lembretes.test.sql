-- Horário e lembretes (D206). Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
create temp table ctx as
select p.id as inbox,
       (now() at time zone 'America/Sao_Paulo')::date as today,
       ((now() at time zone 'America/Sao_Paulo') - interval '5 minutes')::time(0) as past,
       ((now() at time zone 'America/Sao_Paulo') + interval '2 hours')::time(0) as later,
       -- Depois das 22h, "daqui a 2 horas" já é amanhã
       ((now() at time zone 'America/Sao_Paulo') + interval '2 hours')::date as later_day
from public.pages p join public.folders f on f.id = p.folder_id
where f.owner_id = '11111111-1111-1111-1111-111111111111' and p.is_inbox;
grant select on ctx to authenticated;
update public.profiles set timezone = 'America/Sao_Paulo' where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_tasks_batch((select inbox from ctx), jsonb_build_array(
  jsonb_build_object('title', 'Ligar', 'due_date', (select today from ctx), 'due_time', (select past from ctx), 'remind_before', 0),
  jsonb_build_object('title', 'Depois', 'due_date', (select later_day from ctx), 'due_time', (select later from ctx), 'remind_before', 30),
  jsonb_build_object('title', 'Sem data', 'due_time', '10:00', 'remind_before', 0)));
select is((select due_time from public.tasks where title = 'Ligar'), (select past from ctx), 'lote grava o horário');
select is((select due_time from public.tasks where title = 'Sem data'), null::time, 'sem data, sem horário');
select throws_ok($$ update public.tasks set reminded_at = now() where title = 'Ligar' $$, '42501', null,
  'reminded_at é do servidor');

reset role;
select is(public.send_task_reminders(), 1, 'só o que já venceu avisa');
select is((select count(*)::int from public.notifications where kind = 'task_reminder'
           and payload ->> 'title' = 'Ligar' and user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'quem criou recebe o lembrete');
select is(public.send_task_reminders(), 0, 'não avisa duas vezes');

set local role authenticated;
update public.tasks set due_time = (select past from ctx) - interval '1 minute' where title = 'Ligar';
reset role;
select is((select reminded_at from public.tasks where title = 'Ligar'), null::timestamptz,
  'mudar a hora rearma o lembrete');
-- Feed do calendário: com horário, evento com hora (em UTC, 30 min)
insert into public.calendar_feeds (user_id, token) values ('11111111-1111-1111-1111-111111111111', repeat('a', 32));
update public.tasks set due_date = '2026-12-01', due_time = '15:00' where title = 'Depois';
select ok(public.calendar_ics(repeat('a', 32)) like '%DTSTART:20261201T180000Z%', 'feed leva o horário em UTC');
update public.tasks set status = 'done' where title = 'Ligar';
select is(public.send_task_reminders(), 0, 'concluída não avisa');

select * from finish();
rollback;
