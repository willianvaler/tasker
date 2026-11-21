-- GP4 (D316): valor da hora por pessoa e padrão do projeto; orçamento (trabalho + gastos, previsto ×
-- realizado); o valor de cada pessoa só para quem gerencia e para ela mesma.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local');
insert into public.folders (id, owner_id, name, is_shared) values
  ('f0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Cliente X', true);
insert into public.folder_members (folder_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'editor');
insert into public.pages (id, folder_id, name) values
  ('b0000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000006', 'Entregas');
insert into public.pages (id, folder_id, name, view_type, budget_cents) values
  ('b0000000-0000-0000-0000-000000000022', 'f0000000-0000-0000-0000-000000000006', 'Gastos', 'expenses', 50000);
insert into public.tasks (id, page_id, title, estimate_minutes, created_by) values
  ('c0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000021', 'Layout', 60, '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000021', 'Revisão', 30, '11111111-1111-1111-1111-111111111111');
insert into public.task_assignees (task_id, user_id) values
  ('c0000000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222');
insert into public.time_entries (user_id, task_id, folder_id, source, started_at, ended_at, minutes)
values ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000021',
        'f0000000-0000-0000-0000-000000000006', 'manual', now() - interval '30 minutes', now(), 30);
insert into public.expenses (page_id, spent_on, description, amount_cents, currency, kind, created_by) values
  ('b0000000-0000-0000-0000-000000000022', current_date, 'Licença', 20000, 'BRL', 'out', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000022', current_date, 'Fonte', 1000, 'USD', 'out', '11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ insert into public.project_rates (folder_id, user_id, cents_per_hour) values
  ('f0000000-0000-0000-0000-000000000006', null, 6000),
  ('f0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 12000) $$,
  'quem gerencia define o padrão e o valor da Bia');
select throws_ok($$ insert into public.project_rates (folder_id, user_id, cents_per_hour) values
  ('f0000000-0000-0000-0000-000000000006', null, 1) $$, '23505', null, 'um padrão só');
create temp table b as select public.project_budget('f0000000-0000-0000-0000-000000000006') as j;
-- 60 min × R$ 120 (Bia) + 30 min × R$ 60 (padrão) = R$ 150; realizado 30 min × R$ 120 = R$ 60
select is((select (j ->> 'work_planned')::int from b), 15000, 'trabalho previsto');
select is((select (j ->> 'work_actual')::int from b), 6000, 'trabalho realizado');
select is((select (j ->> 'expenses_planned')::int || '/' || (j ->> 'expenses_actual') || '/' || (j ->> 'other_currency') from b),
  '50000/20000/1', 'gastos: orçamento, saídas na moeda do projeto e o que ficou de fora');
select is((select (j -> 'people' -> 0 ->> 'cents')::int from b), 6000, 'quem gerencia vê o custo por pessoa');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.project_rates), 1, 'a Bia vê só o próprio valor');
update public.project_rates set cents_per_hour = 99999 where user_id = '22222222-2222-2222-2222-222222222222';
select is((select cents_per_hour from public.project_rates), 12000, 'e não muda');
select is((public.project_budget('f0000000-0000-0000-0000-000000000006') ->> 'default_rate'), null, 'nem vê o padrão');
select is((public.project_budget('f0000000-0000-0000-0000-000000000006') -> 'people' -> 0 ->> 'cents')::int, 6000,
  'vê o próprio custo');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.project_budget('f0000000-0000-0000-0000-000000000006') $$, 'P0002', null,
  'estranho não vê o orçamento');

select * from finish();
rollback;
