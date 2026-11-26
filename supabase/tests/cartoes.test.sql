-- ET1 (D386): repetição espaçada. `pergunta ?:: resposta` vira cartão por trigger e some com a linha;
-- mudar a resposta mantém o cartão; quem é da pasta vê e revisa; estranho não vê nem revisa; o log é
-- só de inserção; o estado (SM-2 modificado) é o mesmo em qualquer ordem de chegada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'leitor@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.notes (id, title, body) values
  ('e0000000-0000-0000-0000-000000000001', 'Biologia',
   E'# Célula\n- Organela da energia ?:: Mitocôndria\nO que é DNA ?:: Ácido desoxirribonucleico\n'
   || E'```\ncódigo ?:: não conta\n```\n ?:: sem pergunta\nsó texto');

select is((select count(*)::int from public.cards where note_id = 'e0000000-0000-0000-0000-000000000001'), 2,
  'duas linhas viram cartões (código e linha sem pergunta não)');
select is((select question || ' = ' || answer from public.cards where position = 1
           and note_id = 'e0000000-0000-0000-0000-000000000001'),
  'Organela da energia = Mitocôndria', 'sem o começo de lista');
select throws_ok($$insert into public.cards (id, note_id, user_id, question, answer)
  values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a', 'b')$$,
  '42501', null, 'ninguém grava cartão direto');

-- Revisões fora de ordem: a segunda chega antes da primeira, o estado é o de revisar em ordem
create temp table c1 as select id from public.cards where position = 1
  and note_id = 'e0000000-0000-0000-0000-000000000001';
grant select on c1 to authenticated;
insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
select 'f0000000-0000-0000-0000-000000000002', id, 4, '2026-11-02', '2026-11-02 10:00Z' from c1;
insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
select 'f0000000-0000-0000-0000-000000000001', id, 4, '2026-11-01', '2026-11-01 10:00Z' from c1;
insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
select 'f0000000-0000-0000-0000-000000000003', id, 5, '2026-11-08', '2026-11-08 10:00Z' from c1;
select is((select format('%s %s %s %s', reps, ease, interval_days, due) from public.card_states
           where card_id = (select id from c1)),
  '3 260 16 2026-11-24', 'três acertos: 1, 6 e 6 × 2,6 = 16 dias');
-- Errar: volta a 1 dia e tira no máximo 0,20
insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
select 'f0000000-0000-0000-0000-000000000004', id, 0, '2026-11-24', '2026-11-24 10:00Z' from c1;
select is((select format('%s %s %s %s %s', reps, lapses, ease, interval_days, due) from public.card_states
           where card_id = (select id from c1)),
  '0 1 240 1 2026-11-25', 'errar volta a 1 dia e tira 0,20');
select throws_ok($$insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
  select gen_random_uuid(), id, 6, current_date, now() from c1$$, '23514', null, 'nota de 0 a 5');
select throws_ok($$update public.card_reviews set grade = 5$$, '42501', null, 'o log não muda');
select throws_ok($$delete from public.card_reviews$$, '42501', null, 'nem apaga');

-- Mudar a resposta mantém o cartão (e o histórico); mudar a pergunta começa outro
update public.notes set body = E'- Organela da energia ?:: A mitocôndria\nO que é RNA ?:: Ácido ribonucleico'
  where id = 'e0000000-0000-0000-0000-000000000001';
select is((select answer from public.cards where id = (select id from c1)), 'A mitocôndria',
  'a resposta muda no mesmo cartão');
select is((select count(*)::int from public.card_reviews where card_id = (select id from c1)), 4,
  'e o histórico fica');
select is((select count(*)::int from public.cards where note_id = 'e0000000-0000-0000-0000-000000000001'
           and question = 'O que é DNA'), 0, 'a linha apagada leva o cartão');

-- Na pasta: quem é da pasta vê e revisa; estranho não
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Estudo', 'project');
insert into public.notes (id, title, body, folder_id) values
  ('e0000000-0000-0000-0000-000000000002', 'Química', 'Símbolo do ouro ?:: Au', 'aaaaaaaa-0000-0000-0000-000000000001');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.cards), 1, 'quem é da pasta vê o cartão dela (e não os pessoais da Ana)');
select lives_ok($$insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
  select gen_random_uuid(), id, 4, current_date, now() from public.cards$$, 'e revisa');
select is((select count(*)::int from public.card_reviews), 1, 'vê só as próprias revisões');
select is((select reps from public.card_states), 1, 'o estado é de cada pessoa');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.cards), 0, 'estranho não vê');
select throws_ok($$insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
  select gen_random_uuid(), id, 4, current_date, now() from c1$$, '42501', null, 'nem revisa');

-- Exporta
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(jsonb_array_length(public.export_my_data() -> 'card_reviews'), 4, 'as revisões entram na exportação');

select * from finish();
rollback;
