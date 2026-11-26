-- SA2 (ESCOPO_V15 §5, D383): água. Registro em mL (o copo é um atalho), meta do dia, pelo sync
-- (funciona sem conexão). Dado de saúde: só com o consentimento `health` (SA0), só a dona vê,
-- revogar apaga, entra na exportação e sai com a conta. O lembrete é um modelo de automação.

-- Preferências do módulo Saúde: uma linha por pessoa (o id é o da pessoa, como o sync pede)
create table public.health_settings (
  id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 10000),
  cup_ml integer not null default 250 check (cup_ml between 50 and 2000),
  updated_at timestamptz not null default now()
);
alter table public.health_settings enable row level security;
revoke all on public.health_settings from anon;
revoke insert, update on public.health_settings from authenticated;
grant insert (id, water_goal_ml, cup_ml), update (water_goal_ml, cup_ml)
  on public.health_settings to authenticated;
create policy "health_settings_select" on public.health_settings for select to authenticated
  using (id = (select auth.uid()));
create policy "health_settings_insert" on public.health_settings for insert to authenticated
  with check (id = (select auth.uid()) and public.has_sensitive_consent('health'));
create policy "health_settings_update" on public.health_settings for update to authenticated
  using (id = (select auth.uid())) with check (public.has_sensitive_consent('health'));
create policy "health_settings_delete" on public.health_settings for delete to authenticated
  using (id = (select auth.uid()));

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ml integer not null check (ml between 1 and 5000),
  -- O dia no fuso da pessoa (o app manda o "hoje" dele, como o due_date)
  day date not null check (day between date '2020-01-01' and current_date + 1),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index water_logs_user_day on public.water_logs (user_id, day);
alter table public.water_logs enable row level security;
revoke all on public.water_logs from anon;
revoke insert, update on public.water_logs from authenticated;
grant insert (id, ml, day, logged_at), update (ml) on public.water_logs to authenticated;
create policy "water_logs_select" on public.water_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "water_logs_insert" on public.water_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('health'));
create policy "water_logs_update" on public.water_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('health'));
create policy "water_logs_delete" on public.water_logs for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger health_settings_touch before update on public.health_settings
  for each row execute function public.medications_touch();

alter publication powersync add table public.health_settings, public.water_logs;

-- Revogar: para de guardar e apaga o que havia (o registro do consentimento fica, com a data)
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
    delete from public.health_settings where id = auth.uid();
  end if;
end;
$$;

-- A política de privacidade passa a citar o módulo Saúde (D213): todo mundo aceita de novo
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-11-26' $$;

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
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
