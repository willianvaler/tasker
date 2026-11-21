-- AG3 (D312, ESCOPO_V12 §2): "Achar horário" em grupo. Num projeto, time ou clã, quem pede escolhe
-- as pessoas e a duração e recebe os começos em que todas estão livres nos próximos dias: dentro
-- da semana de cada uma (quem não configurou não limita) e fora do que ocupa cada uma (reservas,
-- tarefas com horário, exceções). Cada pessoa vê só livre/ocupado das outras, nunca o que é: a
-- resposta tem só instantes e quem está "sem agenda".

-- Divide algum grupo com a outra pessoa: o mesmo projeto ou pasta compartilhada (raiz), time ou clã
create function public._shares_group(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_a = p_b
    or exists (select 1 from public.folder_members x join public.folder_members y on y.folder_id = x.folder_id
               where x.user_id = p_a and y.user_id = p_b)
    or exists (select 1 from public.team_members x join public.team_members y on y.team_id = x.team_id
               where x.user_id = p_a and y.user_id = p_b)
    or exists (select 1 from public.clan_members x join public.clan_members y on y.clan_id = x.clan_id
               where x.user_id = p_a and y.user_id = p_b)
$$;

-- A pessoa aceita compromisso de p_start a p_end? Sem semana configurada, aceita sempre ("sem
-- agenda"). Conta no fuso dela; o trecho não atravessa a meia-noite.
create function public._within_availability(p_user uuid, p_start timestamptz, p_end timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with tz as (select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') as tz from public.profiles where id = p_user),
  local as (select (p_start at time zone tz.tz) as a, (p_end at time zone tz.tz) as b from tz)
  select not exists (select 1 from public.availability_rules where user_id = p_user)
    or (
      exists (select 1 from public.availability_rules r, local
              where r.user_id = p_user and r.weekday = extract(isodow from local.a)
                and r.starts <= local.a::time
                and ((local.b::date = local.a::date and r.ends >= local.b::time)
                     or (local.b = date_trunc('day', local.a) + interval '1 day' and r.ends = '24:00')))
      and not exists (select 1 from public.availability_exceptions e, local
                      where e.user_id = p_user and e.starts is null and local.a::date between e.starts_on and e.ends_on)
    )
$$;

-- Horários em comum. p_users: as outras pessoas (quem pede entra sempre); até 20, todas de um grupo
-- de quem pede. Um começo a cada 30 min (15 se a duração for menor), de hoje a p_days dias, no fuso
-- de quem pede; sem ninguém com semana configurada, das 9h às 18h dele. Até 200 horários.
create function public.group_free_slots(p_users uuid[], p_duration integer, p_days integer default 7)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_users uuid[];
  v_tz text;
  v_step integer;
  v_dur interval;
  v_busy tstzrange[] := '{}';
  v_user uuid;
  v_any_agenda boolean;
  v_day date;
  v_m integer;
  v_start timestamptz;
  v_slots timestamptz[] := '{}';
  v_today date;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if p_duration is null or p_duration not between 15 and 480 or p_days is null or p_days not between 1 and 14 then
    raise exception 'Duração de 15 a 480 min e de 1 a 14 dias' using errcode = '22023';
  end if;
  v_users := array(select distinct u from unnest(coalesce(p_users, '{}') || v_me) u where u is not null);
  if cardinality(v_users) > 21 then
    raise exception 'Pessoas demais' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_users) u where not public._shares_group(v_me, u)) then
    raise exception 'Só pessoas dos seus projetos, times ou clã' using errcode = '42501';
  end if;
  select coalesce(nullif(timezone, ''), 'America/Sao_Paulo') into v_tz from public.profiles where id = v_me;
  v_today := (now() at time zone v_tz)::date;
  v_step := case when p_duration < 30 then 15 else 30 end;
  v_dur := make_interval(mins => p_duration);
  foreach v_user in array v_users loop
    v_busy := v_busy || public._agenda_busy(v_user, now(), now() + make_interval(days => p_days + 1), null);
  end loop;
  v_any_agenda := exists (select 1 from public.availability_rules where user_id = any (v_users));

  <<days>>
  for v_day in select g::date from generate_series(v_today, v_today + p_days - 1, interval '1 day') g loop
    v_m := case when v_any_agenda then 0 else 9 * 60 end;
    while v_m + p_duration <= case when v_any_agenda then 24 * 60 else 18 * 60 end loop
      v_start := (v_day + make_interval(mins => v_m)) at time zone v_tz;
      if v_start > now()
         and not exists (select 1 from unnest(v_busy) x where x && tstzrange(v_start, v_start + v_dur))
         and not exists (select 1 from unnest(v_users) u
                         where not public._within_availability(u, v_start, v_start + v_dur)) then
        v_slots := v_slots || v_start;
        exit days when cardinality(v_slots) >= 200;
      end if;
      v_m := v_m + v_step;
    end loop;
  end loop;

  return jsonb_build_object(
    'timezone', v_tz,
    'slots', to_jsonb(v_slots),
    'no_agenda', to_jsonb(array(select u from unnest(v_users) u
                                where not exists (select 1 from public.availability_rules r where r.user_id = u))));
end;
$$;

revoke execute on function public._shares_group(uuid, uuid), public._within_availability(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.group_free_slots(uuid[], integer, integer) from public, anon;
grant execute on function public.group_free_slots(uuid[], integer, integer) to authenticated;
