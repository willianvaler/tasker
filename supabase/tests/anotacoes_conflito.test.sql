-- ESCOPO_V16 (ED6): duas edições da mesma anotação; a substituída vai para note_conflicts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.notes (id, title, body) values ('c0000000-0000-0000-0000-000000000001', 'Lista', 'A');

-- Aparelho 1 grava a partir de "A": sem conflito
update public.notes set body = 'B', body_base = encode(sha256(convert_to('A', 'UTF8')), 'hex')
where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.note_conflicts), 0, 'edição a partir do texto atual não é conflito');
select is((select body_base from public.notes where id = 'c0000000-0000-0000-0000-000000000001'), null,
  'a base não fica guardada');

-- Aparelho 2, que também partiu de "A", grava depois: "B" não some
update public.notes set body = 'C', body_base = encode(sha256(convert_to('A', 'UTF8')), 'hex')
where id = 'c0000000-0000-0000-0000-000000000001';
select is((select body from public.notes where id = 'c0000000-0000-0000-0000-000000000001'), 'C', 'a última gravação vale no texto');
select is((select body from public.note_conflicts where note_id = 'c0000000-0000-0000-0000-000000000001'), 'B',
  'e a que ela substituiu fica guardada');

-- Sem base (versão antiga do app): como antes
update public.notes set body = 'D' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.note_conflicts), 1, 'sem base, nada muda');

select throws_ok($$ insert into public.note_conflicts (note_id, body) values ('c0000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'o cliente não grava conflito');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.note_conflicts), 0, 'estranho não vê o conflito');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.note_conflicts;
select is((select count(*)::int from public.note_conflicts), 0, 'a dona descarta');

select * from finish();
rollback;
