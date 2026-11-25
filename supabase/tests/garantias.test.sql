-- ESCOPO_V15 (CS3): garantia do equipamento, a nota fiscal como gasto e os avisos de 30 e 7 dias.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
delete from public.notifications where kind = 'automation' and payload ? 'equipamento';
-- Os equipamentos que os E2E deixaram no banco não entram na conta dos avisos (volta no rollback)
delete from public.equipments;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'dona@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'estranha@teste.local');
update public.profiles set timezone = 'America/Sao_Paulo';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.equipments (id, name, purchased_on, warranty_months) values
  ('e3000000-0000-0000-0000-000000000001', 'Geladeira', '2025-12-25', 12);
select is((select warranty_ends_on from public.equipments where id = 'e3000000-0000-0000-0000-000000000001'),
  '2026-12-25'::date, 'compra + 12 meses');
insert into public.equipments (id, name, warranty_months) values ('e3000000-0000-0000-0000-000000000002', 'Micro-ondas', 12);
select is((select warranty_ends_on from public.equipments where id = 'e3000000-0000-0000-0000-000000000002'), null,
  'sem a data da compra, não há fim (a tela pede a data)');
insert into public.equipments (id, name, warranty_until) values ('e3000000-0000-0000-0000-000000000003', 'TV', '2026-12-02');
select is((select warranty_ends_on from public.equipments where id = 'e3000000-0000-0000-0000-000000000003'),
  '2026-12-02'::date, 'a data dada vale direto');
select throws_ok($$ update public.equipments set warranty_until = '2027-01-01' where id = 'e3000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'meses ou data, não os dois');
select throws_ok($$ update public.equipments set warranty_ends_on = '2030-01-01' $$, '42501', null, 'o fim é do servidor');

-- A nota fiscal é um gasto que a pessoa vê; o da estranha, não
reset role;
insert into public.folders (id, owner_id, name) values ('f3000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Dela');
insert into public.pages (id, folder_id, name, view_type) values ('d3000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000002', 'Gastos', 'expenses');
insert into public.expenses (id, page_id, description, amount_cents, created_by)
values ('c3000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000002', 'TV dela', 300000, '22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok($$ update public.equipments set expense_id = 'c3000000-0000-0000-0000-000000000002' where id = 'e3000000-0000-0000-0000-000000000003' $$,
  '42501', null, 'não liga ao gasto de outra pessoa');

-- Avisos: dia 25/11 às 10 h (São Paulo) faltam 30 dias para a geladeira e 7 para a TV
reset role;
select is(public.send_warranty_alerts('2026-11-25 13:00+00'), 2, 'dois avisos');
select is((select count(*)::int from public.notifications where payload ->> 'equipamento' = 'e3000000-0000-0000-0000-000000000003'
            and payload ->> 'message' = 'A garantia de TV acaba em 7 dias'), 1, 'o texto diz quantos dias faltam');
select is(public.send_warranty_alerts('2026-11-25 14:00+00'), 0, 'cada aviso uma vez');
select is(public.send_warranty_alerts('2026-12-18 13:00+00'), 1, 'a geladeira ganha o de 7 dias depois');
select is(public.send_warranty_alerts('2026-12-20 10:00+00'), 0, 'antes das 9 h no fuso da pessoa, nada');

-- Mudar o fim recomeça os avisos
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.equipments set warranty_until = '2027-06-01' where id = 'e3000000-0000-0000-0000-000000000003';
select is((select warranty_warned from public.equipments where id = 'e3000000-0000-0000-0000-000000000003'), null,
  'garantia nova, avisos zerados');

select * from finish();
rollback;
