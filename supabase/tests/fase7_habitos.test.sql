-- Página de hábitos de sistema (D68) e tipo do hábito na criação em lote. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

create temp table ids as
select p.id from public.pages p join public.folders f on f.id = p.folder_id
where f.owner_id = '11111111-1111-1111-1111-111111111111' and p.is_habits;
grant select on ids to authenticated;

select is((select count(*)::int from ids), 1, 'conta nova ganha a página de hábitos');
select is((select view_type::text from public.pages where id = (select id from ids)), 'habits', 'do tipo hábitos');
select ok((select f.is_inbox from public.pages p join public.folders f on f.id = p.folder_id
           where p.id = (select id from ids)), 'dentro da pasta (escondida) da Caixa de entrada');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select public.create_tasks_batch((select id from ids),
  '[{"title": "Beber água", "habit_kind": "counter", "habit_target": 8},
    {"title": "Comer bem", "habit_kind": "plusminus"},
    {"title": "Meditar"}]');
select is((select habit_kind || ':' || habit_target from public.tasks where title = 'Beber água'), 'counter:8',
  'contador criado já com a meta');
select is((select habit_kind || ':' || coalesce(habit_target::text, '-') from public.tasks where title = 'Comer bem'),
  'plusminus:-', 'bom/ruim criado direto');
select is((select habit_kind from public.tasks where title = 'Meditar'), 'check', 'sem tipo: de marcar');

delete from public.pages where id = (select id from ids);
select is((select count(*)::int from public.pages where id = (select id from ids)), 1, 'não se apaga');
select throws_ok($$ update public.pages set view_type = 'list' where id = (select id from ids) $$,
  '22023', null, 'não muda de tipo');
select throws_ok($$ select public.duplicate_page((select id from ids), 'Cópia') $$, '22023', null, 'não se duplica');

select * from finish();
rollback;
