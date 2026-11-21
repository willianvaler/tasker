-- AG3 (D312): achar horário em grupo. Só com quem divide um grupo; respeita a semana de cada um
-- (quem não configurou não limita e aparece como "sem agenda") e o que ocupa cada um, sem dizer o quê.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'dani@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

-- Projeto da Ana com a Bia e a Dani
insert into public.folders (id, owner_id, name, is_shared) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Projeto', true);
insert into public.folder_members (folder_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('f0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'editor');

-- A segunda-feira da semana que vem (dentro dos 14 dias)
create temp table dia as
select d, (d + time '10:00') at time zone 'America/Sao_Paulo' as h10
from (select current_date + (8 - extract(isodow from current_date))::int as d) x;
grant select on dia to authenticated;

-- Semanas: Ana seg 9–12, Bia seg 10–13; a Dani não configurou. A Bia tem dentista às 11h.
insert into public.availability_rules (user_id, weekday, starts, ends) values
  ('11111111-1111-1111-1111-111111111111', 1, '09:00', '12:00'),
  ('22222222-2222-2222-2222-222222222222', 1, '10:00', '13:00');
insert into public.tasks (page_id, title, due_date, due_time, created_by)
select p.id, 'Dentista', (select d from dia), '11:00', '22222222-2222-2222-2222-222222222222'
from public.pages p join public.folders f on f.id = p.folder_id
where p.is_inbox and f.owner_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table r as
select public.group_free_slots(array['22222222-2222-2222-2222-222222222222',
                                     '44444444-4444-4444-4444-444444444444']::uuid[], 60, 14) as j;
select is((select jsonb_agg(s) from r, jsonb_array_elements(j -> 'slots') s
           where (s #>> '{}')::timestamptz::date between (select d - 1 from dia) and (select d + 1 from dia)
             and extract(isodow from ((s #>> '{}')::timestamptz at time zone 'America/Sao_Paulo')) = 1),
  jsonb_build_array((select h10 from dia)),
  'na segunda, só as 10h: o comum das semanas, sem o dentista da Bia');
select is((select j -> 'no_agenda' from r), '["44444444-4444-4444-4444-444444444444"]'::jsonb,
  'quem não configurou aparece como sem agenda (e não limita)');
select ok(not ((select j::text from r) ~ 'Dentista'), 'não diz o que ocupa');
select ok((select bool_and(extract(isodow from ((s #>> '{}')::timestamptz at time zone 'America/Sao_Paulo')) = 1)
           from r, jsonb_array_elements(j -> 'slots') s), 'fora da semana de quem configurou, nada');

select throws_ok($$ select public.group_free_slots(array['33333333-3333-3333-3333-333333333333']::uuid[], 60, 7) $$,
  '42501', null, 'só com quem divide um grupo');
select throws_ok($$ select public.group_free_slots('{}', 5, 7) $$, '22023', null, 'duração de 15 a 480');

-- Ninguém com semana: das 9h às 18h de quem pede
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select ok((select bool_and(((s #>> '{}')::timestamptz at time zone 'America/Sao_Paulo')::time between '09:00' and '17:00')
           from jsonb_array_elements(public.group_free_slots('{}', 60, 3) -> 'slots') s),
  'sem semana de ninguém, das 9h às 18h');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select public.group_free_slots('{}', 60, 7) $$, '42501', null, 'anônimo não usa');

select * from finish();
rollback;
