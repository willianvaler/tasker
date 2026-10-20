-- C1: calendário. Link secreto do feed (.ics), quem entra no feed e o formato do iCalendar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.folders (id, parent_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cozinha');
-- Treino só na Academia (CD15): a página de cards em outra pasta é comum
select public.set_gym_mode(true);
insert into public.pages (id, folder_id, name, view_type, reset_cycle) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Afazeres', 'list', 'none'),
  ('bbbbbbbb-0000-0000-0000-000000000002', (select id from public.folders where is_gym), 'Treino A', 'cards', 'weekly'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rotina', 'habits', 'daily');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"id": "c0000000-0000-0000-0000-000000000001", "title": "Pagar luz; água, gás"},
    {"id": "c0000000-0000-0000-0000-000000000002", "title": "Sem data"},
    {"id": "c0000000-0000-0000-0000-000000000003", "title": "Já feita"},
    {"id": "c0000000-0000-0000-0000-000000000004", "title": "Faxina"},
    {"id": "c0000000-0000-0000-0000-000000000005", "title": "Aluguel"}]');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000002',
  '[{"id": "c0000000-0000-0000-0000-000000000011", "title": "Supino"},
    {"id": "c0000000-0000-0000-0000-000000000012", "title": "Remada"}]');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000003',
  '[{"id": "c0000000-0000-0000-0000-000000000021", "title": "Beber água"}]');

-- Pasta da Bia: a Ana não vê
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000009', 'Da Bia');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009', 'Dela');
select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000009',
  '[{"id": "c0000000-0000-0000-0000-000000000091", "title": "Segredo da Bia"}]');

reset role;
update public.tasks set due_date = '2026-11-03' where id = 'c0000000-0000-0000-0000-000000000001';
update public.tasks set due_date = '2026-11-03', status = 'done' where id = 'c0000000-0000-0000-0000-000000000003';
update public.tasks set due_date = '2026-11-04', recurrence = '{"type": "weekdays", "days": [1, 3, 5]}'
  where id = 'c0000000-0000-0000-0000-000000000004';
update public.tasks set due_date = '2026-01-31', recurrence = '{"type": "monthly"}'
  where id = 'c0000000-0000-0000-0000-000000000005';
update public.tasks set due_date = '2026-11-02', recurrence = '{"type": "weekly"}'
  where page_id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.tasks set due_date = '2026-11-03', recurrence = '{"type": "daily"}'
  where id = 'c0000000-0000-0000-0000-000000000021';
update public.tasks set due_date = '2026-11-03' where id = 'c0000000-0000-0000-0000-000000000091';

-- RRULE
select is(public._ics_rrule('{"type": "daily"}', '2026-11-03'), 'FREQ=DAILY', 'diária');
select is(public._ics_rrule('{"type": "weekdays", "days": [5, 1, 1]}', '2026-11-03'),
  'FREQ=WEEKLY;BYDAY=MO,FR', 'dias da semana em ordem, sem repetir');
select is(public._ics_rrule('{"type": "monthly"}', '2026-11-15'), 'FREQ=MONTHLY', 'mensal');
select is(public._ics_rrule('{"type": "monthly"}', '2026-01-30'),
  'FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1', 'dia 30: em fevereiro cai no último dia');
select is(public._ics_rrule('{"type": "weekdays", "days": []}', '2026-11-03'), null, 'sem dias, sem regra');
select is(public._ics_text(E'a,b;c\\d\ne'), 'a\,b\;c\\d\ne', 'escapa vírgula, ponto e vírgula, barra e quebra');
select is(public._ics_fold(repeat('é', 50)), repeat('é', 37) || E'\r\n ' || repeat('é', 13),
  'dobra em 75 bytes sem partir o caractere');

-- Link
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table tok as select public.calendar_feed_link() as t;
grant select on tok to authenticated, anon;
select is(public.calendar_feed_link(), (select t from tok), 'pedir de novo devolve o mesmo link');
select ok(length((select t from tok)) = 32 and (select t from tok) !~ '[+/=]', 'token de 32 caracteres, seguro na URL');
select is((select count(*)::int from public.calendar_feeds), 1, 'dono vê o próprio link');
select throws_ok($$ insert into public.calendar_feeds (user_id, token)
  values ('11111111-1111-1111-1111-111111111111', 'escolhido-por-mim-123456') $$, '42501', null,
  'ninguém escreve direto na tabela');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.calendar_feeds), 0, 'estranho não vê o link dos outros');

-- Feed (sem login, só o token)
reset role;
set local role anon;
-- Sem as dobras de 75 bytes, para procurar pelo texto
create temp table ics as select replace(public.calendar_ics((select t from tok), 'https://tasker.exemplo.org'),
  E'\r\n ', '') as body;
select ok((select body from ics) like 'BEGIN:VCALENDAR' || E'\r\n' || '%END:VCALENDAR' || E'\r\n', 'calendário completo, com CRLF');
select ok(strpos((select body from ics), 'SUMMARY:Pagar luz\; água\, gás') > 0, 'tarefa com data entra, com o texto escapado');
select ok((select body from ics) like '%DTSTART;VALUE=DATE:20261103' || E'\r\n' || 'DTEND;VALUE=DATE:20261104%', 'dia inteiro');
select ok((select body from ics) like '%URL:https://tasker.exemplo.org/task/c0000000-0000-0000-0000-000000000001%', 'link de volta para a tarefa');
select ok((select body from ics) not like '%Sem data%', 'sem data fica fora');
select ok(strpos((select body from ics), 'SUMMARY:✓ Já feita') > 0, 'concluída fica, com ✓');
select ok((select body from ics) like '%RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR%'
  and (select body from ics) like '%BYMONTHDAY=28,29,30,31;BYSETPOS=-1%', 'recorrência vira RRULE');
select is((select count(*)::int from regexp_matches((select body from ics), 'SUMMARY:🏋 Treino A', 'g')), 1,
  'página de treino vira um evento só');
select ok(strpos((select body from ics),
  'DESCRIPTION:Supino\nRemada\n\nhttps://tasker.exemplo.org/page/bbbbbbbb-0000-0000-0000-000000000002') > 0,
  'exercícios e link da página na descrição');
select ok((select body from ics) not like '%Beber água%' and (select body from ics) not like '%Segredo da Bia%',
  'hábitos e pastas dos outros ficam fora');
select ok((select body from ics) not like '%URL:javascript%'
  and public.calendar_ics((select t from tok), 'javascript:alert(1)') not like '%URL:%', 'origem estranha não vira link');
select is(public.calendar_ics('token-que-nao-existe-123456'), null, 'token desconhecido: nada');

-- Trocar o link derruba o antigo
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select isnt(public.calendar_feed_link(true), (select t from tok), 'trocar gera outro token');
select is(public.calendar_ics((select t from tok)), null, 'o link antigo para de valer');

select * from finish();
rollback;
