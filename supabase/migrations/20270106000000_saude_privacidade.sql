-- SA0 (ESCOPO_V15 §5, D382): fundação de privacidade da saúde.
-- 1. Consentimento `health` para o módulo Saúde (sono, água, exames…), como o do peso (D239) e o dos
--    remédios (D270): as tabelas de saúde só aceitam escrita com ele ativo, e revogar apaga.
-- 2. `sensitive_releases`: os campos sensíveis (saude.*, local.*, camera.*, dispositivo.*) que a
--    pessoa liberou, um a um, para sair num webhook (V15-4). O motor recusa o resto (no executor).

alter table public.sensitive_consents drop constraint if exists sensitive_consents_purpose_check;
alter table public.sensitive_consents add constraint sensitive_consents_purpose_check
  check (purpose in ('body_metrics', 'medications', 'health'));

create table public.sensitive_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  field text not null check (field ~ '^(saude|local|camera|dispositivo)(\.[a-z0-9_]+)+$' and char_length(field) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, field)
);
alter table public.sensitive_releases enable row level security;
revoke all on public.sensitive_releases from anon, authenticated;
grant select on public.sensitive_releases to authenticated;
create policy "sensitive_releases_select" on public.sensitive_releases for select to authenticated
  using (user_id = (select auth.uid()));

-- Nome do campo em pt-BR, como o motor escreve (apelidos em inglês e espanhol viram o canônico)
create function public._sensitive_field(p_field text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(trim(p_field)),
    '^(health|salud)\.', 'saude.'), '^(location|ubicacion)\.', 'local.'),
    '^(cam|camara)\.', 'camera.'), '^(device)\.', 'dispositivo.');
$$;

create function public.release_sensitive_field(p_field text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_field text := public._sensitive_field(p_field);
begin
  if auth.uid() is null then
    raise exception 'Entre na conta' using errcode = '42501';
  end if;
  if v_field !~ '^(saude|local|camera|dispositivo)(\.[a-z0-9_]+)+$' or char_length(v_field) > 80 then
    raise exception 'Campo sensível inválido (ex.: saude.agua.ml)' using errcode = '22023';
  end if;
  if (select count(*) from public.sensitive_releases where user_id = auth.uid()) >= 50 then
    raise exception 'No máximo 50 campos liberados' using errcode = '22023';
  end if;
  insert into public.sensitive_releases (user_id, field) values (auth.uid(), v_field)
  on conflict (user_id, field) do nothing;
  return v_field;
end;
$$;

create function public.unrelease_sensitive_field(p_field text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.sensitive_releases
  where user_id = auth.uid() and field = public._sensitive_field(p_field);
$$;

create function public._sensitive_released(p_user uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(field order by field), '[]'::jsonb)
  from public.sensitive_releases where user_id = p_user;
$$;

create or replace function public.automation_claim(p_limit integer default 20)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.automation_events;
  v_out jsonb;
begin
  for v_event in
    select * from public.automation_events
    where processed_at is null and available_at <= now()
    order by available_at
    for update skip locked
    limit 100
  loop
    -- A definição vai junto com a execução: editar a regra no meio de um `esperar` não desalinha o
    -- ponteiro. Chegou tarde demais (servidor fora, fila parada)? Vira `perdido`, sem rodar (§6.2)
    insert into public.automation_runs (rule_id, event_id, state, definition, status, finished_at, error)
    select r.id, v_event.id, jsonb_build_object('evento', v_event.payload, 'var', '{}'::jsonb), r.definition,
           case when x.atraso > x.limite then 'perdido' when l.motivo is not null then 'limitada' else 'pendente' end,
           case when x.atraso > x.limite or l.motivo is not null then now() end,
           case when x.atraso > x.limite then
             format('Atrasou %s min (o limite é %s)', floor(x.atraso)::integer, x.limite) else l.motivo end
    from public._automation_matching(v_event.kind, v_event.owner_id, v_event.folder_id, v_event.payload) r,
    lateral (select extract(epoch from now() - coalesce(
                      case when v_event.payload ->> 'previsto' ~ '^\d{4}-' then (v_event.payload ->> 'previsto')::timestamptz end,
                      v_event.created_at)) / 60 as atraso,
                    coalesce((r.definition #>> '{limites,atraso_max_min}')::integer, 15) as limite) x,
    lateral (select public._automation_limited(r) as motivo) l
    on conflict (rule_id, event_id) do nothing;
    update public.automation_events
    set processed_at = now(), claimed_at = now(), attempts = attempts + 1
    where id = v_event.id;
  end loop;

  update public.automation_runs u set status = 'cancelada', finished_at = now()
  from public.automation_rules r
  where r.id = u.rule_id and u.status in ('pendente', 'esperando')
    and (not r.enabled or exists (select 1 from public.profiles p where p.id = r.owner_id and p.automations_paused));

  update public.automation_runs set status = 'falhou', finished_at = now(), error = 'O executor parou no meio 5 vezes'
  where status = 'rodando' and claimed_at < now() - interval '2 minutes' and attempts >= 5;

  with alvo as (
    select id from public.automation_runs
    where status = 'pendente'
       or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
       or (status = 'esperando' and resume_at <= now())
    order by started_at
    for update skip locked
    limit greatest(least(p_limit, 200), 1)
  ), feito as (
    update public.automation_runs u
    set status = 'rodando', claimed_at = clock_timestamp(), attempts = u.attempts + 1, resume_at = null
    from alvo where u.id = alvo.id
    returning u.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'claimed_at', f.claimed_at, 'step', f.step, 'state', f.state,
    'scope', r.scope, 'rule_id', r.id, 'rule_name', r.name, 'definition', coalesce(f.definition, r.definition),
    'fuso', coalesce(p.timezone, 'America/Sao_Paulo'), 'idioma', coalesce(p.locale, 'pt-BR'),
    'usuario', jsonb_build_object('nome', p.display_name, 'nivel', p.level, 'sequencia', p.streak,
                                  'xp', p.xp, 'atrasadas', public._automation_overdue_count(r.owner_id, p.timezone)),
    -- SA0: campos sensíveis que a dona liberou para sair por webhook (o resto o motor recusa)
    'liberados', public._sensitive_released(r.owner_id))), '[]')
  into v_out
  from feito f
  join public.automation_rules r on r.id = f.rule_id
  left join public.profiles p on p.id = r.owner_id;
  return v_out;
end;
$$;

revoke execute on function public._sensitive_released(uuid), public.automation_claim(integer)
  from public, anon, authenticated;
grant execute on function public.automation_claim(integer) to service_role;
grant execute on function public.release_sensitive_field(text), public.unrelease_sensitive_field(text)
  to authenticated;
revoke execute on function public.release_sensitive_field(text), public.unrelease_sensitive_field(text)
  from public, anon;
