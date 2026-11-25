-- ESCOPO_V16 (ED4): botões nas anotações rodam ações do V14 com histórico; webhook e dispositivo
-- pedem confirmação; dado sensível do V15 é recusado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
delete from public.automation_runs;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.notes (id, title, body) values ('c0000000-0000-0000-0000-000000000001', 'Reunião', 'x');

select lives_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'Nova tarefa',
  '{"tipo": "criar_tarefa", "titulo": "Ata de {{evento.titulo}}"}') $$, 'o botão de criar tarefa roda');
select is((select count(*)::int from public.automation_runs r join public.automation_rules u on u.id = r.rule_id
           where u.definition ->> 'sistema' = 'botoes' and r.state #>> '{evento,pagina}' = 'c0000000-0000-0000-0000-000000000001'), 1,
  'vira uma execução do motor, com a página no evento (histórico)');
select is((select count(*)::int from public.automation_rules where definition ->> 'sistema' = 'botoes'), 1,
  'a regra escondida é uma só por pessoa');
select lives_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'Outra',
  '{"tipo": "notificar", "titulo": "oi"}') $$, 'outro botão reaproveita a regra');
select throws_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'Luz',
  '{"tipo": "comandar_dispositivo", "dispositivo": "x", "comando": "ligar"}') $$, '22023',
  'Esta ação mexe em webhook ou dispositivo: confirme', 'dispositivo sem confirmação é recusado');
select throws_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'Vaza',
  '{"tipo": "criar_tarefa", "titulo": "{{saude.peso}}"}') $$, '22023', null, 'dado sensível do V15 é recusado');
select throws_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'x', '{"tipo": "esperar", "minutos": 1}') $$,
  '22023', null, 'só ações, não passos de controle');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.note_button_run('c0000000-0000-0000-0000-000000000001', 'x', '{"tipo": "notificar", "titulo": "y"}') $$,
  '42501', null, 'quem não vê a anotação não aperta o botão dela');
select throws_ok($$ select public.note_mark('c0000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'nem marca a anotação (a checagem vale dentro do security definer)');

select * from finish();
rollback;
