-- AG2 (D311): tipos de compromisso e reservas pela página pública. Os horários livres descontam
-- tarefas com horário, reservas e exceções; reservar sem conta vira tarefa e aviso; o segundo no
-- mesmo horário recebe 'taken'; remarcar e cancelar pelo token; aprovação; só a dona lê.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo', username = 'ana_agenda'
where id = '11111111-1111-1111-1111-111111111111';

-- A segunda-feira da semana que vem e as horas dela no fuso da Ana
create temp table dia as
select d, (d + time '09:00') at time zone 'America/Sao_Paulo' as h9,
          (d + time '10:00') at time zone 'America/Sao_Paulo' as h10,
          (d + time '11:00') at time zone 'America/Sao_Paulo' as h11
from (select current_date + (8 - extract(isodow from current_date))::int as d) x;
grant select on dia to anon, authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.set_availability('[{"weekday": 1, "starts": "09:00", "ends": "12:00"}]');
select throws_ok($$ insert into public.booking_types (slug, name) values ('Com Espaço', 'X') $$,
  '23514', null, 'apelido do tipo só com letras minúsculas, números e hífen');
insert into public.booking_types (id, slug, name, duration_min, min_notice_min, max_days)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'conversa', 'Conversa', 60, 0, 60);
insert into public.booking_types (id, slug, name, duration_min, min_notice_min, max_days, needs_approval, ask_phone)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'consulta', 'Consulta', 60, 0, 60, true, 'required');

-- Tarefa da Ana às 10h nesse dia (na Caixa de entrada) ocupa o horário
reset role;
insert into public.tasks (page_id, title, due_date, due_time, created_by)
select p.id, 'Dentista', (select d from dia), '10:00', '11111111-1111-1111-1111-111111111111'
from public.pages p join public.folders f on f.id = p.folder_id
where p.is_inbox and f.owner_id = '11111111-1111-1111-1111-111111111111';

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.booking_profile('Ana_Agenda') ->> 'status', 'ok', 'perfil público pelo apelido (sem diferença de maiúscula)');
select is(jsonb_array_length(public.booking_profile('ana_agenda') -> 'types'), 2, 'os tipos ativos');
select is(public.booking_profile('ninguem') ->> 'status', 'missing', 'apelido que não existe');
select is(public.booking_slots('ana_agenda', 'conversa', (select d from dia), (select d from dia)) -> 'slots',
  jsonb_build_array((select h9 from dia), (select h11 from dia)), 'livres: 9h e 11h (às 10h há tarefa)');
select ok(not (public.booking_slots('ana_agenda', 'conversa', (select d from dia), (select d from dia))::text ~ 'Dentista'),
  'a página pública não vê o que ocupa');
select is(public.booking_slots('ana_agenda', 'conversa', (select d + 1 from dia), (select d + 1 from dia)) -> 'slots',
  '[]'::jsonb, 'terça sem disponibilidade não tem horário');
select throws_ok($$ select * from public.booking_types $$, '42501', null, 'anônimo não lê os tipos');
select throws_ok($$ select * from public.bookings $$, '42501', null, 'anônimo não lê as reservas');

select is(public.book_slot('ana_agenda', 'conversa', (select h9 from dia), 'Bia', 'nao-e-email') ->> 'status',
  'invalid', 'e-mail inválido');
create temp table r1 as
select public.book_slot('ana_agenda', 'conversa', (select h9 from dia), 'Bia', 'Bia@Exemplo.com', null, 'Sobre o projeto') as r;
select is((select r ->> 'status' from r1), 'ok', 'reserva às 9h');
select is((select r -> 'booking' ->> 'status' from r1), 'confirmed', 'confirma sozinha (V12-3)');
select is(public.book_slot('ana_agenda', 'conversa', (select h9 from dia), 'Caio', 'caio@exemplo.com') ->> 'status',
  'taken', 'o segundo no mesmo horário recebe "taken"');
select is(public.book_slot('ana_agenda', 'conversa', (select h9 from dia) + interval '30 minutes', 'Caio', 'caio@exemplo.com') ->> 'status',
  'taken', 'horário fora da grade também é recusado');
select is(public.booking_slots('ana_agenda', 'conversa', (select d from dia), (select d from dia)) -> 'slots',
  jsonb_build_array((select h11 from dia)), 'depois da reserva, só as 11h');
select is(public.book_slot('ana_agenda', 'consulta', (select h11 from dia), 'Caio', 'caio@exemplo.com') ->> 'status',
  'invalid', 'telefone obrigatório no tipo que pede');

reset role;
select is((select t.title || ' · ' || t.due_time::text || ' · ' || t.estimate_minutes || ' · ' || p.name
           from public.bookings b join public.tasks t on t.id = b.task_id join public.pages p on p.id = t.page_id
           where b.guest_name = 'Bia'),
  'Conversa: Bia · 09:00:00 · 60 · Reservas', 'vira tarefa na lista Reservas, com horário e duração');
select ok((select t.notes from public.bookings b join public.tasks t on t.id = b.task_id where b.guest_name = 'Bia')
  ~ 'bia@exemplo.com' , 'as respostas vão na descrição');
select is((select count(*)::int from public.notifications
           where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'booking'), 1, 'a Ana recebe o aviso');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.reschedule_booking((select r ->> 'token' from r1), (select h11 from dia)) ->> 'status', 'ok',
  'remarcar para as 11h pelo token');
reset role;
select is((select t.due_time::text from public.bookings b join public.tasks t on t.id = b.task_id
           where b.guest_name = 'Bia'), '11:00:00', 'a tarefa muda junto');
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.booking_slots('ana_agenda', 'conversa', (select d from dia), (select d from dia), (select r ->> 'token' from r1)) -> 'slots',
  jsonb_build_array((select h9 from dia), (select h11 from dia)), 'remarcando, a própria reserva não ocupa');
select is(public.cancel_booking((select r ->> 'token' from r1)) -> 'booking' ->> 'status', 'cancelled', 'cancelar pelo token');
select is(public.cancel_booking((select r ->> 'token' from r1)) ->> 'status', 'closed', 'cancelada não cancela de novo');
reset role;
select is((select count(*)::int from public.tasks where title = 'Conversa: Bia'), 0, 'a tarefa sai (vai para a lixeira)');

-- Aprovação
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.book_slot('ana_agenda', 'consulta', (select h11 from dia), 'Caio', 'caio@exemplo.com', '1199999') -> 'booking' ->> 'status',
  'pending', 'tipo com aprovação fica pendente');
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.bookings), 0, 'estranho não vê as reservas');
select throws_ok($$ select public.respond_booking((select id from public.bookings limit 1), 'approve') $$,
  'P0002', null, 'estranho não aprova');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.respond_booking((select id from public.bookings where status = 'pending'), 'approve') $$,
  'a dona aprova');
select ok((select task_id is not null from public.bookings where guest_name = 'Caio'), 'aprovada, vira tarefa');
select ok(jsonb_array_length(public.export_my_data() -> 'bookings') = 2
  and not (public.export_my_data() -> 'bookings' -> 0 ? 'token'), 'entra na exportação, sem o token');

-- Exceção do dia inteiro tira o dia
insert into public.availability_exceptions (starts_on, ends_on) select d, d from dia;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.booking_slots('ana_agenda', 'conversa', (select d from dia), (select d from dia)) -> 'slots',
  '[]'::jsonb, 'exceção do dia inteiro: nenhum horário');

select * from finish();
rollback;
