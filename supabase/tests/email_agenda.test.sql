-- AG5 (D320): a fila de e-mail da agenda. Reservar, aprovar, recusar, remarcar e cancelar põem o
-- e-mail certo na fila (com o link da reserva); fechar a enquete manda para quem deixou e-mail;
-- ninguém de fora lê a fila.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Isolado das sobras dos E2E (a transação desfaz no fim)
delete from public.email_outbox;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo', username = 'ana_email', display_name = 'Ana', locale = 'pt-BR'
where id = '11111111-1111-1111-1111-111111111111';
insert into public.app_config (key, value) values ('app_url', 'https://exemplo.test')
on conflict (key) do update set value = excluded.value;

insert into public.bookings (id, owner_id, type_name, starts_at, ends_at, guest_name, guest_email, status)
values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Conversa',
        now() + interval '3 days', now() + interval '3 days 30 minutes', 'Bia', 'bia@teste.local', 'pending');
select is((select kind from public.email_outbox order by created_at desc limit 1), 'booking_pending',
  'pedido pendente avisa quem pediu');
select ok((select payload ->> 'link' from public.email_outbox limit 1) like 'https://exemplo.test/reserva/%',
  'o e-mail leva o link da reserva');
select is((select to_email from public.email_outbox limit 1), 'bia@teste.local', 'para o e-mail de quem pediu');

update public.bookings set status = 'confirmed' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.email_outbox where kind = 'booking_confirmed'), 1, 'aprovar confirma');
update public.bookings set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'
where id = 'b0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.email_outbox where kind = 'booking_rescheduled'), 1, 'remarcar avisa');
update public.bookings set status = 'cancelled', cancelled_by = 'owner' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select payload ->> 'cancelled_by' from public.email_outbox where kind = 'booking_cancelled'), 'owner',
  'cancelar avisa e diz quem cancelou');

insert into public.bookings (owner_id, type_name, starts_at, ends_at, guest_name, guest_email, status)
values ('11111111-1111-1111-1111-111111111111', 'Conversa', now() + interval '4 days',
        now() + interval '4 days 30 minutes', 'Caio', 'caio@teste.local', 'pending');
update public.bookings set status = 'declined' where guest_name = 'Caio';
select is((select count(*)::int from public.email_outbox where kind = 'booking_declined'), 1, 'recusar avisa');

-- Enquete fechada: só quem deixou e-mail
insert into public.time_polls (id, owner_id, title, duration_min)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Café', 30);
insert into public.time_poll_slots (id, poll_id, starts_at)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', now() + interval '5 days'),
       ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', now() + interval '6 days');
insert into public.time_poll_votes (poll_id, voter, name, email, slots) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'voter-dani-000000001', 'Dani', 'dani@teste.local', '{cccccccc-0000-0000-0000-000000000001}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'voter-eva-0000000001', 'Eva', 'eva@teste.local', '{cccccccc-0000-0000-0000-000000000002}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'voter-fabi-000000001', 'Fabi', null, '{}');
update public.time_polls set status = 'closed', chosen_slot = 'cccccccc-0000-0000-0000-000000000001'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.email_outbox where kind = 'poll_closed'), 2,
  'enquete fechada manda para quem deixou e-mail');
select is((select (payload ->> 'could')::boolean from public.email_outbox where kind = 'poll_closed' and to_email = 'eva@teste.local'),
  false, 'diz quem não tinha marcado o horário');

-- Ninguém de fora lê a fila
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'a dona não lê a fila');
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'anônimo não lê a fila');

select * from finish();
rollback;
