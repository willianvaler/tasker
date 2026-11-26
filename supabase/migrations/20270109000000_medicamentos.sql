-- SA3 (D385): medicamentos. Os Remédios do Bem-estar (D270) ganham horários e dias da semana, e cada
-- dose do dia vira uma linha no histórico (`medication_intakes`): Tomei, Pular ou Adiar (até 3
-- vezes, 15 min cada). O servidor avisa na hora da dose e no fim de cada adiamento (🔔 e push, com
-- os botões no celular). Por padrão o aviso NÃO diz o nome do remédio (V15-7): o nome só entra no
-- payload quando a pessoa liga `show_name` naquele remédio. Sem bula, interação, dose ou
-- recomendação: o app só guarda o que a pessoa escreve.

alter table public.medications
  add column dose_times time[] not null default '{}' check (cardinality(dose_times) <= 12),
  -- Dias da semana (0 = domingo); vazio = segue o "a cada quantos dias"
  add column weekdays smallint[] not null default '{}' check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(weekdays) <= 7),
  add column show_name boolean not null default false;
grant insert (dose_times, weekdays, show_name), update (dose_times, weekdays, show_name)
  on public.medications to authenticated;

-- Dia de dose: os dias da semana marcados ou, sem eles, a cada `every_days` desde a contagem
-- (espelho de `isDoseDay` em lib/medications.ts)
create function public._medication_dose_day(p_weekdays smallint[], p_every smallint, p_stock_on date, p_day date)
returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when cardinality(p_weekdays) > 0 then extract(dow from p_day)::smallint = any (p_weekdays)
    else (((p_day - p_stock_on) % greatest(p_every, 1)) + greatest(p_every, 1)) % greatest(p_every, 1) = 0
  end
$$;

-- Uma linha por dose (remédio, dia, horário). O id é calculado no app a partir dos três, então
-- dois aparelhos sem conexão gravam a mesma linha e a dose não aparece duas vezes.
create table public.medication_intakes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  day date not null,
  slot time not null,
  status text not null check (status in ('taken', 'skipped', 'snoozed')),
  snoozes smallint not null default 0 check (snoozes between 0 and 3),
  snoozed_until timestamptz,
  acted_at timestamptz not null default now(),
  unique (medication_id, day, slot),
  check (status <> 'snoozed' or (snoozed_until is not null and snoozes > 0))
);
create index medication_intakes_user on public.medication_intakes (user_id, day);

alter table public.medication_intakes enable row level security;
revoke all on public.medication_intakes from anon;
revoke insert, update on public.medication_intakes from authenticated;
grant insert (id, medication_id, day, slot, status, snoozes, snoozed_until, acted_at),
  update (status, snoozes, snoozed_until, acted_at)
  on public.medication_intakes to authenticated;
create policy "medication_intakes_select" on public.medication_intakes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "medication_intakes_insert" on public.medication_intakes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('medications')
    and exists (select 1 from public.medications m
                where m.id = medication_id and m.user_id = (select auth.uid())));
create policy "medication_intakes_update" on public.medication_intakes for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('medications'));
create policy "medication_intakes_delete" on public.medication_intakes for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication powersync add table public.medication_intakes;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction', 'friend_request', 'friend_accepted', 'added_to_group', 'workout_reminder',
  'challenge_finished', 'note_shared', 'booking', 'booking_cancelled', 'booking_rescheduled', 'poll_vote',
  'medication'));
create index notifications_medication on public.notifications (user_id, created_at)
  where kind = 'medication';

-- A cada minuto: doses de hoje (no fuso da pessoa) que chegaram na hora, sem Tomei nem Pular, e
-- adiamentos que acabaram. Cada rodada (0 = a hora da dose, 1 a 3 = depois de cada Adiar) avisa
-- uma vez só, e só até 2 h depois (para não avisar coisa velha).
create function public.send_medication_reminders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  v_count integer := 0;
begin
  for v in
    with dose as (
      select m.id, m.user_id, m.name, m.show_name, s.slot,
             (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date as day,
             coalesce(p.timezone, 'America/Sao_Paulo') as tz,
             m.weekdays, m.every_days, m.stock_on
      from public.medications m
      join public.profiles p on p.id = m.user_id
      cross join lateral unnest(m.dose_times) as s(slot)
      where not m.paused and cardinality(m.dose_times) > 0
        and public.has_sensitive_consent_of(m.user_id, 'medications')
    )
    select d.*, coalesce(i.snoozes, 0) as round,
           case when i.status = 'snoozed' then i.snoozed_until
                else (d.day + d.slot) at time zone d.tz end as due
    from dose d
    left join public.medication_intakes i
      on i.medication_id = d.id and i.day = d.day and i.slot = d.slot
    where public._medication_dose_day(d.weekdays, d.every_days, d.stock_on, d.day)
      and (i.id is null or i.status = 'snoozed')
  loop
    continue when v.due > now() or v.due < now() - interval '2 hours';
    continue when exists (
      select 1 from public.notifications n
      where n.user_id = v.user_id and n.kind = 'medication' and n.created_at > now() - interval '1 day'
        and n.payload ->> 'medication_id' = v.id::text and n.payload ->> 'day' = v.day::text
        and n.payload ->> 'slot' = to_char(v.slot, 'HH24:MI') and (n.payload ->> 'round')::int = v.round);
    insert into public.notifications (user_id, kind, payload)
    values (v.user_id, 'medication', jsonb_build_object(
      'medication_id', v.id, 'day', v.day, 'slot', to_char(v.slot, 'HH24:MI'), 'round', v.round)
      -- O nome só vai quando a pessoa pediu (V15-7): o push nem chega a carregar
      || case when v.show_name then jsonb_build_object('name', v.name) else '{}'::jsonb end);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- O varredor roda sem sessão: consentimento de outra pessoa
create function public.has_sensitive_consent_of(p_user uuid, p_purpose text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.sensitive_consents
                 where user_id = p_user and purpose = p_purpose and revoked_at is null)
$$;
revoke execute on function public.has_sensitive_consent_of(uuid, text) from public, anon, authenticated;
revoke execute on function public.send_medication_reminders() from public, anon, authenticated;
select cron.schedule('questlist-medicamentos', '* * * * *', 'select public.send_medication_reminders()');

-- O histórico entra na exportação (revogar apaga os remédios e, em cascata, o histórico)
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return public._export_my_data_base() || jsonb_build_object(
    'equipments', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.equipments e
                            where e.user_id = v_user), '[]'),
    'maintenance_plans', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.maintenance_plans m
                                   where m.user_id = v_user), '[]'),
    -- Saúde (SA0, SA2): o que a pessoa anota e os campos sensíveis que liberou para webhooks
    'health_settings', (select to_jsonb(h) - 'id' from public.health_settings h where h.id = v_user),
    'water_logs', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.logged_at)
                            from public.water_logs w where w.user_id = v_user), '[]'),
    'sleep_logs', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.day, s.bed_time)
                            from public.sleep_logs s where s.user_id = v_user), '[]'),
    -- Medicamentos (SA3): o histórico de cada dose
    'medication_intakes', coalesce((select jsonb_agg(to_jsonb(i) - 'user_id' order by i.day, i.slot)
                                    from public.medication_intakes i where i.user_id = v_user), '[]'),
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
