-- SA1 (ESCOPO_V15 §5, D384): sono. Registro manual de quando dormiu e acordou (o dia é o de
-- acordar, no fuso da pessoa); a duração é conta do app (passa da meia-noite quando acordou "antes"
-- de dormir). Meta de horas nas preferências da saúde. Dado de saúde: como a água (SA2).

alter table public.health_settings
  add column sleep_goal_min integer not null default 480 check (sleep_goal_min between 180 and 960);
grant insert (sleep_goal_min), update (sleep_goal_min) on public.health_settings to authenticated;

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null check (day between date '2020-01-01' and current_date + 1),
  bed_time time not null,
  wake_time time not null,
  created_at timestamptz not null default now(),
  check (bed_time <> wake_time)
);
create index sleep_logs_user_day on public.sleep_logs (user_id, day);
alter table public.sleep_logs enable row level security;
revoke all on public.sleep_logs from anon;
revoke insert, update on public.sleep_logs from authenticated;
grant insert (id, day, bed_time, wake_time), update (day, bed_time, wake_time)
  on public.sleep_logs to authenticated;
create policy "sleep_logs_select" on public.sleep_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "sleep_logs_insert" on public.sleep_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('health'));
create policy "sleep_logs_update" on public.sleep_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('health'));
create policy "sleep_logs_delete" on public.sleep_logs for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication powersync add table public.sleep_logs;

create or replace function public.revoke_sensitive_consent(p_purpose text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.sensitive_consents set revoked_at = now()
  where user_id = auth.uid() and purpose = p_purpose and revoked_at is null;
  if p_purpose = 'body_metrics' then
    delete from public.body_metrics where user_id = auth.uid();
    delete from public.body_goals where user_id = auth.uid();
  elsif p_purpose = 'medications' then
    delete from public.medications where user_id = auth.uid();
  elsif p_purpose = 'health' then
    delete from public.water_logs where user_id = auth.uid();
    delete from public.sleep_logs where user_id = auth.uid();
    delete from public.health_settings where id = auth.uid();
  end if;
end;
$$;

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
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
