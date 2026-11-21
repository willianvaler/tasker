-- GP1 (D313): reunião é uma lista do tipo 'meeting'; meeting.manage para Dono, Gerente e Editor (não
-- para Colaborador nem Leitor); a reunião não encerrada ocupa a agenda de quem participa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('55555555-5555-5555-5555-555555555555', 'colab@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
             '55555555-5555-5555-5555-555555555555');
insert into public.folders (id, owner_id, name, is_shared) values
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Projeto', true);
insert into public.folder_members (folder_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('f0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'contributor');

create temp table dia as
select d, (d + time '10:00') at time zone 'America/Sao_Paulo' as h10
from (select current_date + (8 - extract(isodow from current_date))::int as d) x;
grant select on dia to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok(public.has_permission('f0000000-0000-0000-0000-000000000002', 'meeting.manage'), 'Editor conduz reunião');
select lives_ok($$ insert into public.pages (id, folder_id, name, view_type, config)
  select 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'Semanal', 'meeting',
         jsonb_build_object('meeting', jsonb_build_object('date', d, 'time', '10:00', 'duration', 60,
                            'participants', jsonb_build_array('22222222-2222-2222-2222-222222222222')))
  from dia $$, 'cria a lista do tipo reunião');
select lives_ok($$ insert into public.tasks (page_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Orçamento') $$,
  'item da pauta é uma tarefa da lista');

set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select ok(not public.has_permission('f0000000-0000-0000-0000-000000000002', 'meeting.manage'), 'Colaborador não conduz');

reset role;
select ok((select tstzrange((select h10 from dia), (select h10 from dia) + interval '1 hour') = any (
  public._agenda_busy('22222222-2222-2222-2222-222222222222', (select h10 from dia) - interval '1 day',
                      (select h10 from dia) + interval '1 day', null))), 'a reunião ocupa a agenda de quem participa');
select ok(not exists (select 1 from unnest(public._agenda_busy('11111111-1111-1111-1111-111111111111',
  (select h10 from dia) - interval '1 day', (select h10 from dia) + interval '1 day', null)) r
  where r = tstzrange((select h10 from dia), (select h10 from dia) + interval '1 hour')), 'quem não participa fica livre');
update public.pages set config = jsonb_set(config, '{meeting,status}', '"done"')
where id = 'a0000000-0000-0000-0000-000000000001';
select is(cardinality(public._agenda_busy('22222222-2222-2222-2222-222222222222', (select h10 from dia) - interval '1 day',
  (select h10 from dia) + interval '1 day', null)), 0, 'encerrada não ocupa mais');

select * from finish();
rollback;
