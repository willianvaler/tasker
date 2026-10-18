-- V4 §2 (P2, D180): 35 conquistas novas (68 no total) e concessão pelas séries.
--
-- As de faixa saem dos dados (série + meta) com os números de _achievement_progress; as
-- especiais (uma condição própria) continuam no código. Conquista não é retirada ao desmarcar.
-- Nomes e descrições daqui são em pt (avisos do servidor e feed do clã); o app mostra pelo i18n.

insert into public.achievements (key, name, description, icon, position, rarity, category, series, goal, secret) values
  ('tasks_2500', '2.500 tarefas', '2.500 tarefas concluídas', '📚', 100, 'epic', 'tasks', 'tasks', 2500, false),
  ('tasks_5000', '5.000 tarefas', '5.000 tarefas concluídas', '🏛️', 101, 'epic', 'tasks', 'tasks', 5000, false),
  ('tasks_10000', '10.000 tarefas', '10.000 tarefas concluídas', '🗿', 102, 'legendary', 'tasks', 'tasks', 10000, false),
  ('tasks_25000', '25.000 tarefas', '25.000 tarefas concluídas', '🌌', 103, 'legendary', 'tasks', 'tasks', 25000, false),
  ('estimates_100', 'Bom de estimativa', 'Concluir 100 tarefas com tempo estimado', '⏱️', 104, 'rare', 'tasks', 'estimates', 100, false),
  ('tree_5', 'Raiz profunda', 'Concluir uma tarefa no 5º nível de uma árvore', '🌳', 105, 'rare', 'tasks', null, null, false),
  ('streak_60', '60 dias seguidos', '60 dias seguidos concluindo tarefas', '🌄', 110, 'rare', 'streak', 'streak', 60, false),
  ('streak_180', '180 dias seguidos', '180 dias seguidos concluindo tarefas', '☄️', 111, 'epic', 'streak', 'streak', 180, false),
  ('streak_365', 'Um ano inteiro', '365 dias seguidos concluindo tarefas', '🌞', 112, 'legendary', 'streak', 'streak', 365, false),
  ('boss_10', '10 bosses', 'Derrotar 10 bosses semanais, de clã ou de projeto', '🪓', 120, 'uncommon', 'bosses', 'bosses', 10, false),
  ('boss_50', '50 bosses', 'Derrotar 50 bosses semanais, de clã ou de projeto', '🦂', 121, 'epic', 'bosses', 'bosses', 50, false),
  ('boss_100', '100 bosses', 'Derrotar 100 bosses semanais, de clã ou de projeto', '☠️', 122, 'legendary', 'bosses', 'bosses', 100, false),
  ('daily_1', 'Primeiro boss do dia', 'Derrotar o boss do dia pela primeira vez', '🌤️', 123, 'common', 'bosses', 'daily_bosses', 1, false),
  ('daily_30', '30 bosses do dia', 'Derrotar 30 bosses do dia', '📅', 124, 'rare', 'bosses', 'daily_bosses', 30, false),
  ('daily_100', '100 bosses do dia', 'Derrotar 100 bosses do dia', '🗓️', 125, 'epic', 'bosses', 'daily_bosses', 100, false),
  ('daily_365', '365 bosses do dia', 'Derrotar 365 bosses do dia', '🌍', 126, 'legendary', 'bosses', 'daily_bosses', 365, false),
  ('daily_streak_7', 'Semana sem folga', 'Derrotar o boss do dia 7 dias seguidos', '⛓️', 127, 'uncommon', 'bosses', 'daily_streak', 7, false),
  ('daily_streak_30', 'Mês sem folga', 'Derrotar o boss do dia 30 dias seguidos', '🔗', 128, 'epic', 'bosses', 'daily_streak', 30, false),
  ('clan_top', 'Linha de frente', 'Ser quem mais contribuiu para derrotar um boss de clã', '🥇', 129, 'rare', 'bosses', null, null, false),
  ('level_30', 'Nível 30', 'Chegar ao nível 30', '🛡️', 130, 'rare', 'levels', 'level', 30, false),
  ('level_40', 'Nível 40', 'Chegar ao nível 40', '⚜️', 131, 'epic', 'levels', 'level', 40, false),
  ('level_50', 'Nível 50', 'Chegar ao nível 50', '🏰', 132, 'epic', 'levels', 'level', 50, false),
  ('level_75', 'Nível 75', 'Chegar ao nível 75', '🐉', 133, 'legendary', 'levels', 'level', 75, false),
  ('level_100', 'Nível 100', 'Chegar ao nível 100', '💎', 134, 'legendary', 'levels', 'level', 100, false),
  ('habits_1000', 'Mil marcações', 'Marcar hábitos 1.000 vezes', '🌲', 140, 'rare', 'habits', 'habits', 1000, false),
  ('habits_5000', 'Cinco mil marcações', 'Marcar hábitos 5.000 vezes', '🏞️', 141, 'epic', 'habits', 'habits', 5000, false),
  ('projects_10', '10 projetos', 'Concluir 10 projetos (com 5 tarefas ou mais)', '🗂️', 150, 'rare', 'projects', 'projects', 10, false),
  ('projects_50', '50 projetos', 'Concluir 50 projetos (com 5 tarefas ou mais)', '🏗️', 151, 'epic', 'projects', 'projects', 50, false),
  ('delegated_100', 'Quem delega, avança', '100 tarefas criadas por você e concluídas por outra pessoa', '📨', 152, 'epic', 'projects', 'delegated', 100, false),
  ('team_create', 'Time formado', 'Criar um time', '👥', 153, 'common', 'projects', 'teams', 1, false),
  ('team_10', 'Time completo', 'Ter um time com 10 pessoas', '🏟️', 154, 'rare', 'projects', 'team_size', 10, false),
  ('midnight', 'Virada', 'Concluir uma tarefa nos primeiros 5 minutos depois da meia-noite', '🕛', 160, 'rare', 'special', null, null, true),
  ('comeback', 'De volta', 'Voltar a concluir tarefas depois de 30 dias parado', '🔄', 161, 'rare', 'special', null, null, true),
  ('fifty_day', 'Dia de maratona', 'Concluir 50 tarefas num só dia', '⚡', 162, 'epic', 'special', null, null, true),
  ('pomodoro_8', 'Foco total', 'Fazer 8 pomodoros num só dia', '🍅', 163, 'rare', 'special', null, null, true);

-- Nomes e descrições em pt iguais aos do app (feed do clã e avisos do servidor)
update public.achievements a set name = v.name, description = v.description
from (values
  ('first_task', 'Primeiro passo', 'Concluir a primeira tarefa'),
  ('tasks_10', '10 tarefas', '10 tarefas concluídas'),
  ('tasks_100', '100 tarefas', '100 tarefas concluídas'),
  ('tasks_500', '500 tarefas', '500 tarefas concluídas'),
  ('tasks_1000', '1.000 tarefas', '1.000 tarefas concluídas'),
  ('tasks_2500', '2.500 tarefas', '2.500 tarefas concluídas'),
  ('tasks_5000', '5.000 tarefas', '5.000 tarefas concluídas'),
  ('tasks_10000', '10.000 tarefas', '10.000 tarefas concluídas'),
  ('tasks_25000', '25.000 tarefas', '25.000 tarefas concluídas'),
  ('page_complete', 'Página fechada', 'Marcar uma página de cards inteira'),
  ('estimates_100', 'Bom de estimativa', 'Concluir 100 tarefas com tempo estimado'),
  ('tree_5', 'Raiz profunda', 'Concluir uma tarefa no 5º nível de uma árvore'),
  ('streak_3', '3 dias seguidos', '3 dias seguidos concluindo tarefas'),
  ('streak_7', 'Uma semana', '7 dias seguidos concluindo tarefas'),
  ('streak_30', 'Um mês', '30 dias seguidos concluindo tarefas'),
  ('streak_60', '60 dias seguidos', '60 dias seguidos concluindo tarefas'),
  ('streak_100', '100 dias seguidos', '100 dias seguidos concluindo tarefas'),
  ('streak_180', '180 dias seguidos', '180 dias seguidos concluindo tarefas'),
  ('streak_365', 'Um ano inteiro', '365 dias seguidos concluindo tarefas'),
  ('first_boss', 'Primeiro boss', 'Derrotar o primeiro boss'),
  ('boss_5', '5 bosses', 'Derrotar 5 bosses semanais, de clã ou de projeto'),
  ('boss_10', '10 bosses', 'Derrotar 10 bosses semanais, de clã ou de projeto'),
  ('boss_25', '25 bosses', 'Derrotar 25 bosses semanais, de clã ou de projeto'),
  ('boss_50', '50 bosses', 'Derrotar 50 bosses semanais, de clã ou de projeto'),
  ('boss_100', '100 bosses', 'Derrotar 100 bosses semanais, de clã ou de projeto'),
  ('daily_1', 'Primeiro boss do dia', 'Derrotar o boss do dia pela primeira vez'),
  ('daily_30', '30 bosses do dia', 'Derrotar 30 bosses do dia'),
  ('daily_100', '100 bosses do dia', 'Derrotar 100 bosses do dia'),
  ('daily_365', '365 bosses do dia', 'Derrotar 365 bosses do dia'),
  ('daily_streak_7', 'Semana sem folga', 'Derrotar o boss do dia 7 dias seguidos'),
  ('daily_streak_30', 'Mês sem folga', 'Derrotar o boss do dia 30 dias seguidos'),
  ('boss_level_5', 'Boss de peso', 'Derrotar um boss de nível 5 ou mais'),
  ('clan_boss', 'Em grupo', 'Derrotar um boss de clã'),
  ('clan_top', 'Linha de frente', 'Ser quem mais contribuiu para derrotar um boss de clã'),
  ('level_3', 'Nível 3', 'Chegar ao nível 3'),
  ('level_5', 'Nível 5', 'Chegar ao nível 5'),
  ('level_10', 'Nível 10', 'Chegar ao nível 10'),
  ('level_20', 'Nível 20', 'Chegar ao nível 20'),
  ('level_30', 'Nível 30', 'Chegar ao nível 30'),
  ('level_40', 'Nível 40', 'Chegar ao nível 40'),
  ('level_50', 'Nível 50', 'Chegar ao nível 50'),
  ('level_75', 'Nível 75', 'Chegar ao nível 75'),
  ('level_100', 'Nível 100', 'Chegar ao nível 100'),
  ('class_chosen', 'Com rumo', 'Escolher uma classe'),
  ('first_skill', 'Primeira habilidade', 'Usar a habilidade da sua classe'),
  ('attr_5', 'Em forma', 'Distribuir 5 pontos de atributo'),
  ('first_crit', 'Crítico', 'Acertar um crítico no boss'),
  ('big_hit', 'Golpe forte', 'Causar 15 de dano ou mais num golpe só'),
  ('first_purchase', 'Primeira compra', 'Comprar um item na loja'),
  ('first_drop', 'Espólio', 'Ganhar um item de um boss'),
  ('collector', 'Colecionador', 'Ter 10 itens'),
  ('gold_500', 'Bolsa cheia', 'Ganhar 500 de ouro no total'),
  ('counter_goal', 'Meta batida', 'Bater a meta de um hábito contador'),
  ('plus_50', 'Bons hábitos', 'Registrar 50 vezes um hábito bom'),
  ('habits_1000', 'Mil marcações', 'Marcar hábitos 1.000 vezes'),
  ('habits_5000', 'Cinco mil marcações', 'Marcar hábitos 5.000 vezes'),
  ('project_done', 'Antes do prazo', 'Derrotar o boss de um projeto antes do prazo'),
  ('projects_10', '10 projetos', 'Concluir 10 projetos (com 5 tarefas ou mais)'),
  ('projects_50', '50 projetos', 'Concluir 50 projetos (com 5 tarefas ou mais)'),
  ('delegated_100', 'Quem delega, avança', '100 tarefas criadas por você e concluídas por outra pessoa'),
  ('team_create', 'Time formado', 'Criar um time'),
  ('team_10', 'Time completo', 'Ter um time com 10 pessoas'),
  ('early_bird', 'Madrugador', 'Concluir uma tarefa antes das 7h'),
  ('night_owl', 'Coruja', 'Concluir uma tarefa depois das 23h'),
  ('midnight', 'Virada', 'Concluir uma tarefa nos primeiros 5 minutos depois da meia-noite'),
  ('comeback', 'De volta', 'Voltar a concluir tarefas depois de 30 dias parado'),
  ('fifty_day', 'Dia de maratona', 'Concluir 50 tarefas num só dia'),
  ('pomodoro_8', 'Foco total', 'Fazer 8 pomodoros num só dia')
) as v(key, name, description)
where a.key = v.key;

-- Ordem do catálogo: por categoria, a série principal antes das outras, a meta, e por fim as
-- especiais (sem série) na ordem de antes
with ordered as (
  select key, row_number() over (
    order by array_position(array['tasks', 'streak', 'bosses', 'levels', 'character', 'habits', 'projects', 'special'], category),
             array_position(array['tasks', 'estimates', 'streak', 'bosses', 'daily_bosses', 'daily_streak', 'level',
                                  'attributes', 'items', 'gold', 'habit_plus', 'habits', 'projects', 'delegated',
                                  'teams', 'team_size'], series) nulls last,
             goal nulls last, position) as n
  from public.achievements
)
update public.achievements a set position = o.n from ordered o where o.key = a.key;

create or replace function public._achievement_progress(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_user;
  return jsonb_build_object(
    'tasks', (select count(*) from public.xp_events
              where user_id = p_user and not reverted and kind in ('task', 'too_fast')),
    'streak', coalesce(v_profile.streak_best, 0),
    'level', coalesce(v_profile.level, 1),
    'bosses', (select count(*) from public.xp_events e
               where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'
                 and not exists (select 1 from public.bosses b where b.id = e.boss_id and b.scope = 'daily')),
    'daily_bosses', (select count(*) from public.xp_events e
                     join public.bosses b on b.id = e.boss_id and b.scope = 'daily'
                     where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward'),
    'daily_streak', public.daily_boss_streak(p_user),
    'attributes', coalesce(v_profile.attr_str + v_profile.attr_agi + v_profile.attr_int + v_profile.attr_con, 0),
    'items', (select count(*) from public.user_items where user_id = p_user),
    'gold', (select coalesce(sum(gold), 0) from public.xp_events where user_id = p_user and not reverted),
    'habit_plus', (select count(*) from public.xp_events
                   where user_id = p_user and not reverted and kind = 'habit_plus'),
    -- Marcar hábito: conclusão numa página de hábitos, mais cada "+" do bom/ruim
    'habits', (select count(*) from public.xp_events e
               join public.tasks t on t.id = e.task_id
               join public.pages p on p.id = t.page_id
               where e.user_id = p_user and not e.reverted and e.kind in ('task', 'too_fast')
                 and (p.is_habits or p.view_type = 'habits'))
              + (select count(*) from public.xp_events
                 where user_id = p_user and not reverted and kind = 'habit_plus'),
    'estimates', (select count(*) from public.tasks
                  where completed_by = p_user and status = 'done' and estimate_minutes is not null),
    'delegated', (select count(*) from public.tasks
                  where created_by = p_user and status = 'done'
                    and completed_by is not null and completed_by <> p_user),
    -- Projeto concluído: o projeto (e as subpastas) com 5 tarefas ou mais, todas feitas
    'projects', (
      select count(*) from public.folders f
      where f.kind = 'project'
        and f.id in (select folder_id from public.folder_members where user_id = p_user)
        and (
          with recursive tree as (
            select f.id union all
            select c.id from public.folders c join tree on c.parent_id = tree.id
          )
          select count(*) >= 5 and bool_and(t.status = 'done')
          from public.tasks t where t.folder_id in (select id from tree)
        )
    ),
    'teams', (select count(*) from public.teams where created_by = p_user),
    'team_size', coalesce((select max(n) from (
      select count(*) as n from public.team_members m
      join public.teams tm on tm.id = m.team_id and tm.created_by = p_user
      group by m.team_id) s), 0)
  );
end;
$$;
revoke execute on function public._achievement_progress(uuid) from public, anon, authenticated;

create or replace function public._check_achievements(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_progress jsonb := public._achievement_progress(p_user);
  v_tz text;
  v_keys text[];
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  v_tz := coalesce(v_profile.timezone, 'America/Sao_Paulo');

  -- Faixas: a meta da série alcançada (P2)
  select coalesce(array_agg(key), '{}') into v_keys from public.achievements
  where series is not null and coalesce((v_progress ->> series)::numeric, 0) >= goal;

  -- Especiais: uma condição própria cada
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'page_bonus') then
    v_keys := array_append(v_keys, 'page_complete');
  end if;
  if exists (select 1 from public.xp_events e join public.bosses b on b.id = e.boss_id
             where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward' and b.level >= 5) then
    v_keys := array_append(v_keys, 'boss_level_5');
  end if;
  if exists (select 1 from public.xp_events e join public.bosses b on b.id = e.boss_id
             where e.user_id = p_user and not e.reverted and e.kind = 'boss_reward' and b.scope = 'clan') then
    v_keys := array_append(v_keys, 'clan_boss');
  end if;
  if exists (select 1 from public.bosses b where b.scope = 'folder' and b.status = 'defeated'
             and public.folder_root(b.scope_id) in (select folder_id from public.folder_members where user_id = p_user)) then
    v_keys := array_append(v_keys, 'project_done');
  end if;
  if v_profile.class is not null then v_keys := array_append(v_keys, 'class_chosen'); end if;
  if v_profile.skill_day is not null then v_keys := array_append(v_keys, 'first_skill'); end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and crit) then
    v_keys := array_append(v_keys, 'first_crit');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and damage >= 15) then
    v_keys := array_append(v_keys, 'big_hit');
  end if;
  if exists (select 1 from public.user_items where user_id = p_user and source = 'shop') then
    v_keys := array_append(v_keys, 'first_purchase');
  end if;
  if exists (select 1 from public.user_items where user_id = p_user and source = 'drop') then
    v_keys := array_append(v_keys, 'first_drop');
  end if;
  if exists (select 1 from public.xp_events e join public.tasks t on t.id = e.task_id
             where e.user_id = p_user and not e.reverted and e.kind = 'task' and t.habit_kind = 'counter') then
    v_keys := array_append(v_keys, 'counter_goal');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) < 7) then
    v_keys := array_append(v_keys, 'early_bird');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) >= 23) then
    v_keys := array_append(v_keys, 'night_owl');
  end if;
  -- Quem mais bateu num boss de clã derrotado (só os bosses em que a pessoa bateu)
  if exists (
    select 1 from public.bosses b
    where b.scope = 'clan' and b.status = 'defeated'
      and exists (select 1 from public.boss_damage d where d.boss_id = b.id and d.user_id = p_user)
      and (select d.user_id from public.boss_damage d where d.boss_id = b.id
           group by d.user_id order by sum(d.amount) desc, min(d.created_at) limit 1) = p_user
  ) then
    v_keys := array_append(v_keys, 'clan_top');
  end if;
  if exists (select 1 from public.tasks where completed_by = p_user and status = 'done' and depth >= 5) then
    v_keys := array_append(v_keys, 'tree_5');
  end if;
  -- Secretas
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             and extract(hour from created_at at time zone v_tz) = 0
             and extract(minute from created_at at time zone v_tz) < 5) then
    v_keys := array_append(v_keys, 'midnight');
  end if;
  if exists (select 1 from (
               select created_at - lag(created_at) over (order by created_at) as gap
               from public.xp_events
               where user_id = p_user and not reverted and kind in ('task', 'too_fast')) g
             where g.gap >= interval '30 days') then
    v_keys := array_append(v_keys, 'comeback');
  end if;
  if exists (select 1 from public.xp_events
             where user_id = p_user and not reverted and kind in ('task', 'too_fast')
             group by (created_at at time zone v_tz)::date having count(*) >= 50) then
    v_keys := array_append(v_keys, 'fifty_day');
  end if;
  if exists (select 1 from public.time_entries
             where user_id = p_user and source = 'pomodoro'
             group by (ended_at at time zone v_tz)::date having count(*) >= 8) then
    v_keys := array_append(v_keys, 'pomodoro_8');
  end if;

  with inserted as (
    insert into public.user_achievements (user_id, achievement_key)
    select p_user, k from unnest(v_keys) k
    on conflict do nothing
    returning achievement_key
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'icon', a.icon) order by a.position), '[]')
  into v_new
  from inserted i join public.achievements a on a.key = i.achievement_key;
  return v_new;
end;
$$;
revoke execute on function public._check_achievements(uuid) from public, anon, authenticated;
