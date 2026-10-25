-- AC12.1 / AC12.3: o lote grava a regra de progressão do item; valor estranho vira null
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dono@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.folders (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Academia');
insert into public.pages (id, folder_id, name, view_type, reset_cycle, progression) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Casa A', 'cards', 'weekly', 'double');

select lives_ok($$ select public.create_tasks_batch('bbbbbbbb-0000-0000-0000-000000000001', '[
  {"id": "c0000000-0000-0000-0000-000000000001", "title": "Prancha", "progression": "time",
   "repeat_plan": {"mode": "timed", "total": 3, "duration_seconds": 30, "rest_seconds": 45}},
  {"id": "c0000000-0000-0000-0000-000000000002", "title": "Flexão", "progression": "inventada"},
  {"id": "c0000000-0000-0000-0000-000000000003", "title": "Agachamento"}
]'::jsonb) $$, 'cria o lote com a regra');
select is((select progression from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 'time',
  'a regra do item fica gravada');
select is((select count(*)::int from public.tasks where progression is null
           and id in ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')), 2,
  'regra desconhecida ou ausente fica com a da lista (null)');

select * from finish();
rollback;
