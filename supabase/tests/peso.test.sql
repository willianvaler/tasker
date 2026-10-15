-- V3 §6 (M3): o peso da tarefa aumenta o golpe no boss, não o XP.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(public.weight_factor(null), 1::numeric, 'sem peso: 1×');
select is(public.weight_factor(5::smallint), 2::numeric, 'peso 5: 2×');

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Casa');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Obra');
insert into public.tasks (id, page_id, title, weight) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Leve', null),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pesada', 5);
reset role;
update public.tasks set created_at = now() - interval '1 hour';
update public.pages set created_at = now() - interval '1 hour';
set local role authenticated;

create temp table r as select
  public.complete_task('c0000000-0000-0000-0000-000000000001') as leve,
  public.complete_task('c0000000-0000-0000-0000-000000000002') as pesada;
select is((select (pesada ->> 'xp')::int from r), (select (leve ->> 'xp')::int from r), 'o XP é o mesmo');
-- Golpe base 4 (Força 1: ×1,05 → 4); peso 5 → 8; crítico dobra
select ok((select (leve ->> 'damage')::int from r) in (4, 8), 'peso 1: golpe normal');
select ok((select (pesada ->> 'damage')::int from r) in (8, 16), 'peso 5: golpe dobrado');

select * from finish();
rollback;
