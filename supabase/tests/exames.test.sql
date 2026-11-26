-- SA4 (D389): exames. Sem o consentimento nada grava; só a dona vê e mexe; a faixa é coerente; o
-- anexo tem de ser o da linha e só a dona lê o arquivo; trocar ou apagar manda o arquivo para a
-- limpeza; revogar apaga; exporta.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$insert into public.exam_results (day, name, value, unit) values (current_date, 'Glicose', 92, 'mg/dL')$$,
  '42501', null, 'sem consentimento, o exame não grava');
select public.grant_sensitive_consent('health');
select lives_ok($$insert into public.exam_results (id, day, name, value, unit, ref_low, ref_high)
  values ('e0000000-0000-0000-0000-000000000001', '2026-05-10', 'Glicose', 92, 'mg/dL', 70, 99)$$,
  'com consentimento, grava com a faixa digitada');
select throws_ok($$insert into public.exam_results (day, name, value, ref_low, ref_high) values (current_date, 'TSH', 2, 5, 1)$$,
  '23514', null, 'faixa com o mínimo acima do máximo não vale');
select throws_ok($$insert into public.exam_results (day, name, value) values (current_date, '  ', 2)$$,
  '23514', null, 'nome vazio não vale');
select lives_ok($$update public.exam_results set value = 95 where id = 'e0000000-0000-0000-0000-000000000001'$$,
  'a dona edita');

-- Anexo: só o caminho desta linha
select throws_ok($$update public.exam_results set file_path = '22222222-2222-2222-2222-222222222222/e0000000-0000-0000-0000-000000000001.pdf',
  file_mime = 'application/pdf' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '22023', null, 'o anexo não pode apontar para a pasta de outra pessoa');
update public.exam_results set file_path = '11111111-1111-1111-1111-111111111111/e0000000-0000-0000-0000-000000000001.pdf',
  file_mime = 'application/pdf' where id = 'e0000000-0000-0000-0000-000000000001';
reset role;
insert into storage.objects (bucket_id, name, owner_id) values
  ('health', '11111111-1111-1111-1111-111111111111/e0000000-0000-0000-0000-000000000001.pdf', '11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'health'), 1, 'a dona vê o arquivo');
select is(public.export_my_data() -> 'exam_results' -> 0 ->> 'name', 'Glicose', 'o exame entra na exportação');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.exam_results), 0, 'outra pessoa não vê o exame');
select is((select count(*)::int from storage.objects where bucket_id = 'health'), 0, 'nem o arquivo');
update public.exam_results set value = 1;
delete from public.exam_results;
reset role;
select is((select value::int from public.exam_results where id = 'e0000000-0000-0000-0000-000000000001'), 95,
  'nem muda ou apaga');
set local role authenticated;

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
update public.exam_results set file_path = null, file_mime = null where id = 'e0000000-0000-0000-0000-000000000001';
reset role;
select is((select bucket from public.storage_garbage
           where path = '11111111-1111-1111-1111-111111111111/e0000000-0000-0000-0000-000000000001.pdf'),
  'health', 'tirar o anexo manda o arquivo para a limpeza');
set local role authenticated;

select public.revoke_sensitive_consent('health');
select is((select count(*)::int from public.exam_results), 0, 'revogar apaga os exames');
select throws_ok($$insert into public.exam_results (day, name, value) values (current_date, 'Glicose', 90)$$,
  '42501', null, 'e sem consentimento não grava de novo');

select * from finish();
rollback;
