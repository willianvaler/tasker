begin;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd1@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1"}';

insert into public.folders (id, name) values ('00000000-0000-0000-0000-00000000f0d1', 'Pasta D1');
insert into public.pages (id, folder_id, name) values ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-00000000f0d1', 'Página');
select public.create_tasks_batch('00000000-0000-0000-0000-00000000a0d1', '[{"id": "01920000-0000-7000-8000-0000000000d1", "title": "Tarefa"}]');

select is((select version from public.tasks where title = 'Tarefa'), 1, 'tarefa nasce na versão 1');
update public.tasks set title = 'Tarefa editada' where title = 'Tarefa';
select is((select version from public.tasks where title = 'Tarefa editada'), 2, 'editar sobe a versão');
select is((select updated_by from public.tasks where title = 'Tarefa editada'), '00000000-0000-0000-0000-0000000000d1'::uuid, 'updated_by é quem editou');
update public.pages set name = 'Outra' where id = '00000000-0000-0000-0000-00000000a0d1';
select is((select version from public.pages where id = '00000000-0000-0000-0000-00000000a0d1'), 2, 'página também versiona');
select is((select id from public.tasks where title = 'Tarefa editada'), '01920000-0000-7000-8000-0000000000d1'::uuid, 'id do cliente (v7) é mantido');

select * from finish();
rollback;
