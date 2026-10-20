-- AC9.5 (V6 §8, D243): plano da semana, remarcar e lembrete em dia de treino. Cada treino (página)
-- tem os dias da semana em que é feito; cada pessoa pode remarcar o treino de um dia para outro
-- (ou pular) sem mexer no plano; no fim da tarde, quem tem treino no dia e ainda não registrou
-- nenhuma série recebe um aviso (desligável no Perfil). A regra do dia é a de lib/gym/week-plan.ts.

-- 0 = domingo ... 6 = sábado
alter table public.pages add column train_days smallint[] check (
  train_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(train_days) <= 7);
grant insert (train_days), update (train_days) on public.pages to authenticated;

create table public.workout_moves (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  from_day date not null,
  -- null: pulado
  to_day date check (to_day is distinct from from_day),
  created_at timestamptz not null default now(),
  unique (page_id, user_id, from_day)
);
create index workout_moves_user on public.workout_moves (user_id, from_day);
alter table public.workout_moves enable row level security;
revoke insert, update on public.workout_moves from anon, authenticated;
revoke all on public.workout_moves from anon;
grant insert (id, page_id, from_day, to_day), update (to_day) on public.workout_moves to authenticated;
create policy "workout_moves_select" on public.workout_moves for select to authenticated
  using (user_id = (select auth.uid()));
create policy "workout_moves_insert" on public.workout_moves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.pages p where p.id = page_id
      and (public.is_folder_member(p.folder_id) or public.is_page_recipient(p.id))));
create policy "workout_moves_update" on public.workout_moves for update to authenticated
  using (user_id = (select auth.uid()));
create policy "workout_moves_delete" on public.workout_moves for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication powersync add table public.workout_moves;

-- O treino cai neste dia para a pessoa? Espelho de plannedOn (os mesmos casos nos dois testes)
create function public._planned_on(p_page uuid, p_user uuid, p_day date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.workout_moves m
                 where m.page_id = p_page and m.user_id = p_user and m.to_day = p_day) then true
    when exists (select 1 from public.workout_moves m
                 where m.page_id = p_page and m.user_id = p_user and m.from_day = p_day) then false
    else coalesce((select extract(dow from p_day)::smallint = any (p.train_days)
                   from public.pages p where p.id = p_page), false)
  end;
$$;
revoke execute on function public._planned_on(uuid, uuid, date) from public, anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder'));

-- A hora do aviso (no fuso da pessoa)
create function public.workout_reminder_hour()
returns integer
language sql immutable set search_path = ''
as $$ select 18 $$;

-- Dia de treino passando sem série no diário: um aviso por pessoa e dia (com os treinos do dia)
create function public.send_workout_reminders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  v_count integer := 0;
begin
  for v in
    select pr.id as user_id, (now() at time zone coalesce(pr.timezone, 'America/Sao_Paulo'))::date as today
    from public.profiles pr
    where pr.gym_enabled is true
      and coalesce(pr.ui_prefs -> 'gym' ->> 'remind', 'true') <> 'false'
      and extract(hour from now() at time zone coalesce(pr.timezone, 'America/Sao_Paulo'))
          >= public.workout_reminder_hour()
  loop
    continue when exists (
      select 1 from public.notifications n
      where n.user_id = v.user_id and n.kind = 'workout_reminder' and n.payload ->> 'day' = v.today::text);
    continue when exists (
      select 1 from public.workout_sets w
      where w.user_id = v.user_id and w.performed_at >= (v.today::timestamp at time zone
        coalesce((select timezone from public.profiles where id = v.user_id), 'America/Sao_Paulo')));
    insert into public.notifications (user_id, kind, payload)
    select v.user_id, 'workout_reminder', jsonb_build_object(
      'day', v.today, 'page_id', (array_agg(p.id order by p.position))[1],
      'page_name', string_agg(p.name, ', ' order by p.position), 'count', count(*))
    from public.pages p
    join public.folder_members fm on fm.user_id = v.user_id
      and fm.folder_id = public.folder_root(p.folder_id)
    where public._planned_on(p.id, v.user_id, v.today)
    having count(*) > 0;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_workout_reminders() from public, anon, authenticated;

select cron.schedule('questlist-lembrete-treino', '*/15 * * * *', 'select public.send_workout_reminders()');
