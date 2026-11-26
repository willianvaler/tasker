-- ET2 (D388): estudo conta para o jogo por regra do servidor. A sessão de revisão (10 cartões
-- diferentes no dia) vale XP uma vez, com teto diário; revisão antiga ou feita por automação não
-- vale; o foco de leitura num projeto de estudo conta para a sequência sem XP a mais.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local');
create function pg_temp.study(p_user uuid) returns int language sql security definer as
  $$ select count(*)::int from public.xp_events where user_id = p_user and kind = 'study' and not reverted $$;
create function pg_temp.xp(p_user uuid) returns int language sql security definer as
  $$ select xp from public.profiles where id = p_user $$;
create function pg_temp.today(p_user uuid) returns date language sql security definer as
  $$ select public.user_today(p_user) $$;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- 45 cartões numa anotação
insert into public.notes (id, title, body)
select 'e0000000-0000-0000-0000-000000000001', 'Tabuada',
       string_agg(format('%s × 7 ?:: %s', i, i * 7), E'\n' order by i)
from generate_series(1, 45) i;

create function pg_temp.review(p_from int, p_to int, p_day date) returns void language sql as $$
  insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
  select gen_random_uuid(), id, 4, p_day, now() from public.cards
  where note_id = 'e0000000-0000-0000-0000-000000000001' and position between p_from and p_to
$$;
\set ana '\'11111111-1111-1111-1111-111111111111\''

select pg_temp.review(1, 9, pg_temp.today(:ana));
select is(pg_temp.study(:ana), 0, '9 cartões ainda não fecham uma sessão');
select pg_temp.review(10, 10, pg_temp.today(:ana));
select is(pg_temp.xp(:ana), 5, '10 cartões diferentes: uma sessão, 5 XP');
select pg_temp.review(1, 10, pg_temp.today(:ana));
select is(pg_temp.study(:ana), 1, 'rever os mesmos cartões não dá outra sessão (XP por sessão, não por cartão)');

-- A semana passada (dia mandado pelo aparelho) não vale
select pg_temp.review(11, 30, pg_temp.today(:ana) - 7);
select is(pg_temp.study(:ana), 1, 'revisão com dia antigo não vale XP');

-- Ontem vale (a feita sem internet que subiu hoje), dentro do teto de hoje
select pg_temp.review(1, 10, pg_temp.today(:ana) - 1);
select is(pg_temp.study(:ana), 2, 'a de ontem, que subiu agora, vale');
select pg_temp.review(11, 45, pg_temp.today(:ana));
select is(pg_temp.study(:ana), 3, 'teto do dia: 3 sessões, por mais cartões que sejam');
select is(pg_temp.xp(:ana), 15, '15 XP no dia');
select is((select streak from public.profiles where id = :ana), 1,
  'a revisão conta como dia ativo na sequência');

-- Apagar e recriar os cartões não refaz a sessão: o id sai da pessoa, do dia e do número
update public.notes set body = 'nada' where id = 'e0000000-0000-0000-0000-000000000001';
update public.notes set body = (select string_agg(format('%s × 8 ?:: %s', i, i * 8), E'\n') from generate_series(1, 10) i)
  where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.review(1, 10, pg_temp.today(:ana) - 1);
select is(pg_temp.study(:ana), 3, 'apagar e recriar os cartões não repete a sessão');

-- Dentro de uma automação do V14, a revisão não vale XP
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.notes (id, title, body)
select 'e0000000-0000-0000-0000-000000000002', 'Capitais',
       string_agg(format('País %s ?:: Capital %s', i, i), E'\n') from generate_series(1, 10) i;
select set_config('questlist.automation_depth', '1', true);
insert into public.card_reviews (id, card_id, grade, day, reviewed_at)
select gen_random_uuid(), id, 4, pg_temp.today('22222222-2222-2222-2222-222222222222'), now()
from public.cards where note_id = 'e0000000-0000-0000-0000-000000000002';
select is(pg_temp.study('22222222-2222-2222-2222-222222222222'), 0, 'automação não concede o XP de estudo');
select set_config('questlist.automation_depth', '', true);

-- Leitura: foco de 25 min numa tarefa de projeto de estudo conta para a sequência, sem XP a mais
insert into public.folders (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Concurso', 'project');
update public.folders set study = true where id = 'aaaaaaaa-0000-0000-0000-000000000002';
insert into public.pages (id, folder_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Capítulos');
insert into public.tasks (id, page_id, title) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Ler o capítulo 1');
select public.start_timer('a0000000-0000-0000-0000-000000000002', 'pomodoro', now() - interval '26 minutes', 25 * 60,
                          'cccccccc-0000-0000-0000-000000000002', '{"phase": "focus"}');
select public.update_timer('a0000000-0000-0000-0000-000000000002', 'done');
select is((select format('%s %s', xp, streak) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '5 1', 'foco de leitura: os 5 XP do pomodoro e o dia na sequência');
select public.delete_time_entry((select id from public.time_entries
                                 where timer_id = 'a0000000-0000-0000-0000-000000000002'));
select is((select format('%s %s', xp, streak) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '0 0', 'apagar o registro tira o XP e o dia');

select * from finish();
rollback;
