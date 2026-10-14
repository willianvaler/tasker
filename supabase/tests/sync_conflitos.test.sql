begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d5', 'd5@teste.local'),
  ('00000000-0000-0000-0000-0000000000e5', 'e5@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d5"}';

insert into public.folders (id, name) values ('00000000-0000-0000-0000-00000000f0d5', 'Pasta');
insert into public.pages (id, folder_id, name) values ('00000000-0000-0000-0000-00000000a0d5', '00000000-0000-0000-0000-00000000f0d5', 'Página');
select public.create_tasks_batch('00000000-0000-0000-0000-00000000a0d5',
  '[{"id": "01920000-0000-7000-8000-0000000000d5", "title": "Notas", "labels": ["casa", "mercado"]}]');
\set task '''01920000-0000-7000-8000-0000000000d5'''

-- Sem conflito: o servidor ainda tem a base de quem edita
select public.set_task_notes(:task, 'versão A', null);
select is((select count(*)::int from public.conflict_copies), 0, 'primeira nota não gera cópia');

-- Outro aparelho escreveu "versão B" a partir da mesma base (A): ganha, sem cópia
select public.set_task_notes(:task, 'versão B', 'versão A');
select is((select count(*)::int from public.conflict_copies), 0, 'edição em cima da versão atual não gera cópia');

-- Um aparelho que ainda via "versão A" escreve "versão C": B perde e fica guardada
select public.set_task_notes(:task, 'versão C', 'versão A');
select is((select notes from public.tasks where id = :task), 'versão C', 'a última escrita vence');
select is((select body from public.conflict_copies), 'versão B', 'a versão que perdeu fica na cópia');

-- Etiquetas como conjunto: um tira "casa", outro põe "urgente", nada se perde
select public.patch_task_labels(:task, '{}', '{casa}');
select public.patch_task_labels(:task, '{urgente}', '{}');
select is((select labels from public.tasks where id = :task), '{mercado,urgente}'::text[], 'tirar e pôr de aparelhos diferentes se somam');
select public.patch_task_labels(:task, '{mercado}', '{}');
select is((select labels from public.tasks where id = :task), '{mercado,urgente}'::text[], 'pôr de novo não duplica');

select throws_ok($$insert into public.conflict_copies (task_id, folder_id, body) values ('01920000-0000-7000-8000-0000000000d5', '00000000-0000-0000-0000-00000000f0d5', 'x')$$,
  '42501', null, 'cliente não cria cópia direto');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e5"}';
select is((select count(*)::int from public.conflict_copies), 0, 'estranho não vê as cópias');

select * from finish();
rollback;
