-- AC11 (V6 §9, D251): prêmio para os primeiros do desafio do grupo. Terminado o desafio (o dia
-- seguinte ao último, no fuso de quem criou), o servidor fecha o ranking uma vez: até o 3º lugar
-- ganha a conquista "Pódio", o 1º (empatados dividem a posição, como no app) ganha também a
-- conquista "Campeão de desafio" e o título "Campeão"; cada premiado recebe um aviso. Só premia
-- quando pelo menos duas pessoas treinaram (desafio sozinho não tem disputa) e só quem treinou.
-- Espelho: podium() em src/lib/gym/leaderboard.ts.

alter table public.challenges add column finished_at timestamptz;

-- Item: título que não se compra nem cai de boss, só vem de prêmio
alter table public.user_items drop constraint user_items_source_check;
alter table public.user_items add constraint user_items_source_check
  check (source in ('shop', 'drop', 'prize'));
insert into public.items (key, name, icon, slot, rarity, price, drop, position)
values ('title_campeao', 'Campeão', '🥇', 'title', 'epic', null, false,
        (select max(position) + 1 from public.items));

insert into public.achievements (key, name, description, icon, position, rarity, category, series, goal, secret) values
  ('challenge_podium', 'Pódio', 'Terminar um desafio do grupo entre os três primeiros', '🥉', 181, 'uncommon', 'gym', null, null, false),
  ('challenge_win', 'Campeão de desafio', 'Terminar um desafio do grupo em primeiro lugar', '🥇', 182, 'epic', 'gym', null, null, false);

-- Ordem do catálogo com Academia antes das especiais (como em 20261176000000_conquistas_academia)
with ordered as (
  select key, row_number() over (
    order by array_position(array['tasks', 'streak', 'bosses', 'levels', 'character', 'habits', 'projects', 'gym', 'special'], category),
             array_position(array['tasks', 'estimates', 'streak', 'bosses', 'daily_bosses', 'daily_streak', 'level',
                                  'attributes', 'items', 'gold', 'habit_plus', 'habits', 'projects', 'delegated',
                                  'teams', 'team_size', 'gym_records', 'gym_days', 'gym_tons'], series) nulls last,
             goal nulls last, position) as n
  from public.achievements
)
update public.achievements a set position = o.n from ordered o where o.key = a.key;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder',
  'challenge_finished'));

-- Pódio do desafio: posição pelos dias de treino (empatados dividem: 1, 1, 3), só quem treinou,
-- até o 3º lugar; vazio se menos de duas pessoas treinaram
create function public._challenge_podium(p_challenge_id uuid)
returns table (user_id uuid, place integer, days integer)
language sql stable security definer set search_path = ''
as $$
  with c as (select * from public.challenges where id = p_challenge_id),
  board as (
    select m.u as user_id, count(d.day)::integer as days
    from c
    cross join lateral public._group_members(c.folder_id, c.team_id) m(u)
    left join public.workout_days d on d.user_id = m.u and d.day between c.starts_on and c.ends_on
    group by m.u
  ),
  ranked as (
    select b.user_id, b.days, rank() over (order by b.days desc)::integer as place
    from board b where b.days > 0
  )
  select r.user_id, r.place, r.days from ranked r
  where r.place <= 3 and (select count(*) from ranked) >= 2;
$$;

-- Fecha os desafios que já terminaram e entrega os prêmios (uma vez por desafio). Roda de hora em
-- hora pelo pg_cron; devolve quantos desafios fechou.
create function public.finish_challenges()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_group_name text;
  v_count integer := 0;
  r record;
begin
  for v_challenge in
    select c.* from public.challenges c
    left join public.profiles p on p.id = c.created_by
    where c.finished_at is null
      and c.ends_on < (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
    for update of c skip locked
  loop
    update public.challenges set finished_at = now() where id = v_challenge.id;
    v_count := v_count + 1;
    select coalesce((select name from public.folders where id = v_challenge.folder_id),
                    (select name from public.teams where id = v_challenge.team_id))
    into v_group_name;

    for r in select * from public._challenge_podium(v_challenge.id) loop
      insert into public.user_achievements (user_id, achievement_key)
      values (r.user_id, 'challenge_podium') on conflict do nothing;
      if r.place = 1 then
        insert into public.user_achievements (user_id, achievement_key)
        values (r.user_id, 'challenge_win') on conflict do nothing;
        insert into public.user_items (user_id, item_key, source, price)
        values (r.user_id, 'title_campeao', 'prize', 0) on conflict do nothing;
      end if;
      insert into public.notifications (user_id, kind, payload)
      values (r.user_id, 'challenge_finished', jsonb_build_object(
        'name', v_challenge.name, 'place', r.place, 'days', r.days,
        'challenge_id', v_challenge.id, 'group_name', v_group_name));
    end loop;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public._challenge_podium(uuid), public.finish_challenges()
  from public, anon, authenticated;

select cron.schedule('questlist-finish-challenges', '7 * * * *', $$select public.finish_challenges()$$);
