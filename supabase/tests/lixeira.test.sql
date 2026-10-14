begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d7', 'd7@teste.local'),
  ('00000000-0000-0000-0000-0000000000e7', 'e7@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d7"}';

insert into public.folders (id, name) values ('00000000-0000-0000-0000-00000000f0d7', 'Casa');
insert into public.folders (id, name, parent_id) values ('00000000-0000-0000-0000-00000000f1d7', 'Cozinha', '00000000-0000-0000-0000-00000000f0d7');
insert into public.pages (id, folder_id, name) values ('00000000-0000-0000-0000-00000000a0d7', '00000000-0000-0000-0000-00000000f1d7', 'Mercado');
select public.create_tasks_batch('00000000-0000-0000-0000-00000000a0d7',
  '[{"id": "01920000-0000-7000-8000-0000000000d7", "title": "Leite", "children": [{"title": "Integral"}]}]');
insert into public.comments (id, task_id, body) values ('01920000-0000-7000-8000-0000000c00d7', '01920000-0000-7000-8000-0000000000d7', 'sem lactose');

-- Uma tarefa sozinha
delete from public.tasks where title = 'Integral';
select is((select count(*)::int from public.trash_list()), 1, 'tarefa apagada vai para a lixeira');
select is((select title from public.trash_list()), 'Integral', 'com o título');
select public.restore_deleted((select id from public.trash_list()));
select is((select count(*)::int from public.tasks where title = 'Integral'), 1, 'restaurar traz a tarefa');
select is((select count(*)::int from public.deleted_items), 0, 'e tira da lixeira');

-- A pasta raiz inteira: subpasta, página, tarefas, comentário e participação voltam juntos
delete from public.folders where id = '00000000-0000-0000-0000-00000000f0d7';
select is((select count(*)::int from public.trash_list()), 1, 'pasta apagada é uma linha só na lixeira');
select is((select items from public.trash_list()), 6, 'com tudo o que estava dentro (2 pastas, página, 2 tarefas, comentário)');
select is((select count(*)::int from public.tasks where page_id = '00000000-0000-0000-0000-00000000a0d7'), 0, 'as tarefas saíram de verdade');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e7"}';
select is((select count(*)::int from public.trash_list()), 0, 'estranho não vê a lixeira dos outros');
select throws_ok($$select public.restore_deleted((select id from public.deleted_items limit 1))$$,
  'P0002', null, 'nem restaura');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d7"}';
select public.restore_deleted((select id from public.trash_list()));
select is((select count(*)::int from public.tasks where page_id = '00000000-0000-0000-0000-00000000a0d7'), 2, 'pasta restaurada com as tarefas');
select is((select body from public.comments where task_id = '01920000-0000-7000-8000-0000000000d7'), 'sem lactose', 'e o comentário');

select * from finish();
rollback;
