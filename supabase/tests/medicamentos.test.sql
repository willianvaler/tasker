-- SA3 (D385): medicamentos com horários e histórico. Sem consentimento nada grava; só a dona vê;
-- adiar vai até 3; o aviso sai na hora, não repete, volta depois do adiamento e não diz o nome
-- por padrão; revogar apaga o histórico; exporta.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
update public.profiles set timezone = 'UTC' where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.grant_sensitive_consent('medications');
-- Uma dose 1 min atrás (no fuso UTC) e outra daqui a 3 h
insert into public.medications (id, name, stock, stock_on, dose_times) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Losartana', 30, current_date,
   array[(now() at time zone 'UTC' - interval '1 minute')::time(0),
         (now() at time zone 'UTC' + interval '3 hours')::time(0)]);
select ok((select cardinality(dose_times) from public.medications) = 2, 'horários gravados');
select throws_ok($$update public.medications set weekdays = '{7}'$$, '23514', null, 'dia da semana inválido');

-- Varredor: avisa a dose que chegou, sem o nome
reset role;
select public.send_medication_reminders();
select ok((select count(*)::int from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111') >= 1, 'a dose da hora avisa');
select is((select count(*)::int from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111'), 1, 'só a que chegou');
select ok((select not (payload ? 'name') from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111' limit 1),
  'o aviso não diz o nome');
select public.send_medication_reminders();
select is((select count(*)::int from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111'), 1, 'não avisa de novo');

-- Adiar: a rodada 1 avisa quando o adiamento acaba
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.medication_intakes (id, medication_id, day, slot, status, snoozes, snoozed_until)
select 'bbbbbbbb-0000-0000-0000-000000000001', id, (now() at time zone 'UTC')::date, dose_times[1],
       'snoozed', 1, now() - interval '1 minute'
from public.medications;
select throws_ok($$update public.medication_intakes set snoozes = 4$$, '23514', null, 'adiar vai até 3');
select throws_ok($$update public.medication_intakes set status = 'snoozed', snoozes = 0$$, '23514', null,
  'adiado sem contar não vale');
reset role;
update public.medications set show_name = true;
select public.send_medication_reminders();
select is((select count(*)::int from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111'), 2, 'o adiamento acabou: avisa de novo');
select is((select payload ->> 'name' from public.notifications where kind = 'medication'
           and user_id = '11111111-1111-1111-1111-111111111111' and (payload ->> 'round')::int = 1), 'Losartana', 'com show_name, o nome vai');

-- Tomei: não avisa mais
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.medication_intakes set status = 'taken', snoozed_until = null;
reset role;
delete from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111';
select public.send_medication_reminders();
select is((select count(*)::int from public.notifications where kind = 'medication' and user_id = '11111111-1111-1111-1111-111111111111'), 0, 'tomou: nada a avisar');
set local role authenticated;
select is(public.export_my_data() -> 'medication_intakes' -> 0 ->> 'status', 'taken',
  'o histórico entra na exportação');

-- Outra pessoa: não vê nem grava no remédio da Ana
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.medication_intakes), 0, 'outra pessoa não vê');
select public.grant_sensitive_consent('medications');
select throws_ok($$insert into public.medication_intakes (id, medication_id, day, slot, status)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', current_date, '08:00', 'taken')$$,
  '42501', null, 'nem grava no remédio dos outros');

-- Revogar apaga o histórico; sem consentimento, não grava
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.revoke_sensitive_consent('medications');
select is((select count(*)::int from public.medication_intakes), 0, 'revogar apaga o histórico');
select is((select count(*)::int from public.medications), 0, 'e os remédios');

select * from finish();
rollback;
