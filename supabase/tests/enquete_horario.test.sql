-- AG4 (D319): enquete de horário. A dona propõe de 2 a 5 horários; quem tem o link vota sem conta
-- (e muda o voto pelo `voter`); o público vê nomes, nunca e-mails; mudar os horários tira os
-- removidos dos votos; fechar vira tarefa com horário; só a dona lê as tabelas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo', display_name = 'Ana'
where id in ('11111111-1111-1111-1111-111111111111');

create temp table h as
select (current_date + 7 + time '09:00') at time zone 'America/Sao_Paulo' as h9,
       (current_date + 7 + time '14:00') at time zone 'America/Sao_Paulo' as h14,
       (current_date + 8 + time '10:00') at time zone 'America/Sao_Paulo' as h10;
grant select on h to anon, authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.save_time_poll(null, 'Café', 30, null, array[(select h9 from h)]) $$,
  '22023', null, 'um horário só é recusado');
select lives_ok($$ select public.save_time_poll('aaaaaaaa-0000-0000-0000-000000000001', 'Café com o time', 45,
  'Na padaria', array[(select h9 from h), (select h14 from h), (select h10 from h), (select h9 from h)]) $$,
  'a dona cria a enquete (horário repetido conta uma vez)');
select is((select count(*)::int from public.time_poll_slots), 3, 'três horários');
select throws_ok($$ insert into public.time_polls (owner_id, title) values (auth.uid(), 'Direto') $$,
  '42501', null, 'tabela sem escrita direta');
create temp table tk as select token from public.time_polls where id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on tk to anon, authenticated;
create temp table sl as select id, starts_at from public.time_poll_slots;
grant select on sl to anon, authenticated;

-- Quem tem o link, sem conta
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((public.time_poll_public((select token from tk)) -> 'poll' ->> 'title'), 'Café com o time',
  'o link mostra a enquete');
select is(public.time_poll_public('nao-existe') ->> 'status', 'missing', 'token errado');
select is(public.time_poll_vote((select token from tk), 'voter-bia-0000000001', ' ', null, '{}') ->> 'status',
  'invalid', 'sem nome é recusado');
select is(public.time_poll_vote((select token from tk), 'voter-bia-0000000001', 'Bia', 'bia@teste.local',
  array[(select id from sl where starts_at = (select h9 from h)), (select id from sl where starts_at = (select h14 from h)),
        'ffffffff-0000-0000-0000-000000000000'::uuid]) -> 'poll' -> 'mine' -> 'slots',
  to_jsonb(array[(select id from sl where starts_at = (select h9 from h)), (select id from sl where starts_at = (select h14 from h))]),
  'Bia vota em dois (o horário de fora é ignorado)');
select is(public.time_poll_vote((select token from tk), 'voter-caio-000000001', 'Caio', null,
  array[(select id from sl where starts_at = (select h9 from h))]) ->> 'status', 'ok', 'Caio vota sem e-mail');
select is(public.time_poll_vote((select token from tk), 'voter-caio-000000001', 'Caio', null,
  array[(select id from sl where starts_at = (select h10 from h))]) -> 'poll' ->> 'voters', '2',
  'mudar o voto não conta outra pessoa');
select ok(position('bia@teste.local' in public.time_poll_public((select token from tk))::text) = 0,
  'o link nunca mostra o e-mail');
select is((select jsonb_agg(x) from jsonb_array_elements(public.time_poll_public((select token from tk)) -> 'poll' -> 'slots') x
           where x ->> 'starts_at' is not null and jsonb_array_length(x -> 'names') = 1)::text is not null, true,
  'cada horário traz quem marcou');
select throws_ok($$ select * from public.time_polls $$, '42501', null, 'anônimo não lê a tabela');

-- A dona recebe o aviso e vê os votos; estranho não
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'poll_vote'), 2,
  'um aviso por pessoa (não a cada mudança)');
select is((select count(*)::int from public.time_poll_votes), 2, 'a dona vê os votos');
-- Tirar o horário das 14h tira dos votos
select public.save_time_poll('aaaaaaaa-0000-0000-0000-000000000001', 'Café com o time', 45, null,
  array[(select h9 from h), (select h10 from h)]);
select is((select cardinality(slots) from public.time_poll_votes where name = 'Bia'), 1,
  'horário removido sai do voto');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.time_polls), 0, 'estranho não vê');
select throws_ok($$ select public.close_time_poll('aaaaaaaa-0000-0000-0000-000000000001',
  (select id from sl where starts_at = (select h9 from h))) $$, 'P0002', null, 'estranho não fecha');

-- Fechar: vira tarefa com horário, com quem marcou nas notas
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.close_time_poll('aaaaaaaa-0000-0000-0000-000000000001', (select id from sl where starts_at = (select h9 from h)));
select results_eq($$ select t.title, t.due_time::text, t.estimate_minutes from public.tasks t
  join public.time_polls p on p.task_id = t.id $$,
  $$ values ('Café com o time'::text, '09:00:00'::text, 45) $$, 'a tarefa nasce no horário escolhido');
select ok((select notes from public.tasks t join public.time_polls p on p.task_id = t.id) like '%Bia <bia@teste.local>%',
  'quem marcou vai nas notas');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.time_poll_vote((select token from tk), 'voter-dani-000000001', 'Dani', null, '{}') ->> 'status',
  'closed', 'fechada não recebe voto');
select ok(public.time_poll_public((select token from tk)) -> 'poll' ->> 'chosen' is not null,
  'o link mostra o horário escolhido');

select * from finish();
rollback;
