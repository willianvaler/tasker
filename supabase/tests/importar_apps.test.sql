-- PC1 (D306): o lote do importar (Habitica, Todoist) leva descrição e o lado do hábito bom/ruim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dona@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table imp as select public.create_from_template('Habitica', '', $j${
  "pages": [
    {"name": "Hábitos", "view_type": "habits", "reset_cycle": "daily", "items": [
      {"id": "eeeeeeee-0000-0000-0000-000000000001", "title": "Beber água", "habit_kind": "plusminus", "habit_sides": "up"},
      {"id": "eeeeeeee-0000-0000-0000-000000000002", "title": "Doce", "habit_kind": "plusminus", "habit_sides": "x"},
      {"id": "eeeeeeee-0000-0000-0000-000000000003", "title": "Ler", "habit_sides": "down"}]},
    {"name": "Afazeres", "items": [
      {"id": "eeeeeeee-0000-0000-0000-000000000004", "title": "Relatório", "notes": "capítulo 2"},
      {"id": "eeeeeeee-0000-0000-0000-000000000005", "title": "Vazio", "notes": ""}]}
  ]}$j$::jsonb, false) as id;

select is((select habit_sides from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'up',
  'hábito bom/ruim guarda o lado');
select is((select habit_sides from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000002'), 'both',
  'lado desconhecido vira os dois');
select is((select habit_sides from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000003'), 'both',
  'só o bom/ruim tem lado');
select is((select notes from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000004'), 'capítulo 2',
  'a descrição entra');
select is((select notes from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000005'), null,
  'descrição vazia fica nula');

select * from finish();
rollback;
