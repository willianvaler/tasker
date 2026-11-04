-- PC3 (D308): data de início da tarefa (Gantt). Início não passa do vencimento; repetição leva o
-- início junto; sem vencimento, sem início. Leitor não muda as datas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Obra', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Etapas');
insert into public.tasks (id, page_id, title, start_date, due_date) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Piso', '2026-11-10', '2026-11-14'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pintura', '2026-11-20', '2026-11-18');
insert into public.tasks (id, page_id, title, start_date, due_date, recurrence) values
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Limpeza', '2026-11-02', '2026-11-03',
   '{"type": "weekly"}');
reset role;
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');
set local role authenticated;

select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), '2026-11-10'::date,
  'o início fica gravado');
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), '2026-11-18'::date,
  'início depois do vencimento vem para o vencimento');

update public.tasks set due_date = '2026-11-12' where id = 'c0000000-0000-0000-0000-000000000001';
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), '2026-11-10'::date,
  'mudar só o vencimento (sem repetição) não mexe no início');

update public.tasks set due_date = '2026-11-10' where id = 'c0000000-0000-0000-0000-000000000003';
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000003'), '2026-11-09'::date,
  'repetição leva o início junto, com a mesma duração');

update public.tasks set due_date = null where id = 'c0000000-0000-0000-0000-000000000001';
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), null,
  'sem vencimento, sem início');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.tasks set start_date = '2026-11-01' where id = 'c0000000-0000-0000-0000-000000000002';
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), '2026-11-18'::date,
  'leitor não muda o início');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.tasks set start_date = '2026-11-15' where id = 'c0000000-0000-0000-0000-000000000002';
select is((select start_date from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), '2026-11-15'::date,
  'quem edita arrasta o início');

select * from finish();
rollback;
