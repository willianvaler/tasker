-- V3 §1 (G1): árvore de subtarefas com limite de níveis, ciclo e filhos por tarefa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'ana@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Mudança', 'project');
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plano'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Curta');

-- Cinco níveis: 1 > 2 > 3 > 4 > 5
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Mudar');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cozinha'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Louça'),
  ('c0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Copos'),
  ('c0000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Embrulhar');
select is((select depth::int from public.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 5,
  'profundidade calculada pelo banco');
select is(public.page_max_depth('bbbbbbbb-0000-0000-0000-000000000001'), 5, 'limite padrão: 5');

select throws_ok(
  $$ insert into public.tasks (page_id, parent_task_id, title) values
     ('bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Jornal') $$,
  '22023', 'Isso passaria de 5 níveis. Suba um nível ou aumente o limite do projeto.',
  'sexto nível bloqueado com mensagem clara');

-- Ciclo: "Mudar" não pode ir para dentro de "Copos"
select throws_ok(
  $$ update public.tasks set parent_task_id = 'c0000000-0000-0000-0000-000000000004'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '22023', null, 'sem ciclo na árvore');

-- Mover um galho leva a profundidade dos descendentes junto
update public.tasks set parent_task_id = null where id = 'c0000000-0000-0000-0000-000000000003';
select results_eq(
  $$ select depth::int from public.tasks where id in ('c0000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005') order by depth $$,
  $$ values (1), (2), (3) $$, 'galho movido para a raiz recalcula os níveis');

-- Mover um galho de 3 níveis para debaixo do nível 3 passaria de 5
update public.tasks set parent_task_id = 'c0000000-0000-0000-0000-000000000002'
  where id = 'c0000000-0000-0000-0000-000000000003';
select is((select depth::int from public.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 5,
  'galho volta para o lugar');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Pratos');
select throws_ok(
  $$ update public.tasks set parent_task_id = 'c0000000-0000-0000-0000-000000000006'
     where id = 'c0000000-0000-0000-0000-000000000004' $$,
  '22023', null, 'mover galho que passaria do limite é bloqueado');

-- Limite por página e por projeto, entre 2 e 6
update public.pages set max_depth = 2 where id = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into public.tasks (id, page_id, title) values
  ('c0000000-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000002', 'Caixas');
insert into public.tasks (id, page_id, parent_task_id, title) values
  ('c0000000-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000010', 'Comprar');
select throws_ok(
  $$ insert into public.tasks (page_id, parent_task_id, title) values
     ('bbbbbbbb-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Fita') $$,
  '22023', null, 'limite da página vale');
select throws_ok($$ update public.pages set max_depth = 7 where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  '23514', null, 'limite acima do teto (6) é recusado');
select throws_ok($$ update public.pages set max_depth = 4 where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '22023', 'O limite ficaria abaixo do que já existe: "Embrulhar" (nível 5)',
  'baixar o limite abaixo do que existe diz quais tarefas passam');
select throws_ok($$ update public.folders set max_depth = 3 where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '22023', null, 'o limite do projeto também confere');
update public.folders set max_depth = 6 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(public.page_max_depth('bbbbbbbb-0000-0000-0000-000000000001'), 6, 'limite do projeto vale na página sem limite próprio');
select is(public.page_max_depth('bbbbbbbb-0000-0000-0000-000000000002'), 2, 'limite da página vence o do projeto');

-- Galho que não cabe na página de destino não muda de página
select throws_ok(
  $$ update public.tasks set page_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '22023', null, 'galho maior que o limite da página de destino não muda de página');

-- Duplicar página copia a árvore inteira
create temp table copia on commit drop as
  select public.duplicate_page('bbbbbbbb-0000-0000-0000-000000000001', 'Plano B') as id;
select results_eq(
  $$ select depth::int, count(*)::int from public.tasks where page_id = (select id from copia)
     group by depth order by depth $$,
  $$ values (1, 1), (2, 1), (3, 1), (4, 2), (5, 1) $$, 'duplicar copia todos os níveis');

-- 50 filhos por tarefa
insert into public.tasks (page_id, parent_task_id, title)
select 'bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Item ' || g
from generate_series(1, 50) g;
select throws_ok(
  $$ insert into public.tasks (page_id, parent_task_id, title) values
     ('bbbbbbbb-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Item 51') $$,
  '22023', 'Uma tarefa pode ter no máximo 50 subtarefas', 'máximo de 50 subtarefas por tarefa');

select * from finish();
rollback;
