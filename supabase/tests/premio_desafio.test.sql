-- AC11 (D251): prêmio para os primeiros do desafio. Fecha uma vez, pódio com empate, só com
-- disputa (duas pessoas treinaram), conquistas, título e aviso; ninguém chama de fora.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local'),
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.local'),
  ('44444444-4444-4444-4444-444444444444', 'dani@teste.local');
insert into public.folders (id, owner_id, name, kind, gym_group, is_shared) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Turma', 'project', true, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sozinha', 'project', true, true);
insert into public.folder_members (folder_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer')
on conflict do nothing;

-- Os desafios que já estão no banco (de outros testes) ficam de fora
update public.challenges set finished_at = now() where finished_at is null;
-- Terminado há 3 dias (7 dias desde 10 dias atrás), outro ainda rodando, outro sem disputa
insert into public.challenges (id, folder_id, name, starts_on, days, created_by) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Outubro',
   current_date - 10, 7, '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Novembro',
   current_date, 7, '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Solo',
   current_date - 10, 7, '11111111-1111-1111-1111-111111111111');
-- Ana e Bia com 3 dias (empate no 1º), Caio com 1 (3º), Dani nenhum
insert into public.workout_days (user_id, day, source)
select u, current_date - d, 'page'
from (values ('11111111-1111-1111-1111-111111111111'::uuid, array[10, 9, 8]),
             ('22222222-2222-2222-2222-222222222222'::uuid, array[9, 7, 5]),
             ('33333333-3333-3333-3333-333333333333'::uuid, array[6])) v(u, ds),
     unnest(ds) d;

-- Ninguém chama de fora
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select public.finish_challenges() $$, '42501', null, 'o app não fecha desafio');
reset role;

select is(public.finish_challenges(), 2, 'fecha os dois que terminaram');
select is((select finished_at from public.challenges where id = 'cccccccc-0000-0000-0000-000000000002'), null,
  'o que ainda corre fica aberto');
select is(public.finish_challenges(), 0, 'uma vez só');

select is((select array_agg(user_id order by user_id) from public.user_achievements where achievement_key = 'challenge_win'
           and user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')),
  array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[],
  'empatados no 1º: as duas são campeãs');
select is((select array_agg(user_id order by user_id) from public.user_achievements where achievement_key = 'challenge_podium'
           and user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')),
  array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333']::uuid[],
  'pódio até o 3º (1, 1, 3)');
select is((select array_agg(source) from public.user_items where item_key = 'title_campeao' and user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')),
  array['prize', 'prize'], 'título Campeão só para o 1º, como prêmio');
select is((select count(*)::int from public.user_achievements where user_id = '44444444-4444-4444-4444-444444444444'), 0,
  'quem não treinou não ganha');
select is((select payload ->> 'place' from public.notifications
           where user_id = '33333333-3333-3333-3333-333333333333' and kind = 'challenge_finished'), '3',
  'aviso com a posição');
select is((select count(*)::int from public.notifications where kind = 'challenge_finished'
           and payload ->> 'challenge_id' = 'cccccccc-0000-0000-0000-000000000003'), 0,
  'sem disputa (só uma treinou), sem prêmio');
select is((select finished_at is not null from public.challenges where id = 'cccccccc-0000-0000-0000-000000000003'), true,
  'mas o desafio fecha');

-- A campeã vê o título no inventário
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.user_items where item_key = 'title_campeao'), 1,
  'a campeã vê só o dela');

select * from finish();
rollback;
