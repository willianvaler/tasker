-- E-mail da agenda (AG5, V5-3 com o Resend, D320): quem reservou recebe a confirmação (com o .ics e o
-- link de remarcar ou cancelar), o pedido aguardando aprovação, a recusa, o cancelamento e a
-- remarcação; quem respondeu uma enquete de horário com e-mail recebe o horário escolhido.
--
-- Caminho, o mesmo do push (D58): gatilhos em `bookings` e `time_polls` põem a mensagem na fila
-- `email_outbox`; cada linha nova chama a Edge Function `send-email` pelo pg_net (endereço e segredo
-- em `app_config`: `email_url`, `email_secret`; sem eles, nada sai, como em desenvolvimento), que
-- monta o texto (supabase/functions/_shared/email-text.ts) e manda pelo Resend. As RPCs da agenda
-- não mudam. O que falhar é tentado de novo pelo pg_cron (até 3 vezes); a fila some em 30 dias.

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('booking_confirmed', 'booking_pending', 'booking_declined',
                                     'booking_cancelled', 'booking_rescheduled', 'poll_closed')),
  to_email text not null check (char_length(to_email) <= 254),
  locale text not null default 'pt-BR',
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending on public.email_outbox (created_at) where status <> 'sent';
-- Só o servidor (a função usa a chave de serviço)
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

create function public._email_post(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'email_url');
  v_secret text := (select value from public.app_config where key = 'email_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
end;
$$;

create function public.email_outbox_send()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._email_post(new.id);
  return null;
end;
$$;
create trigger email_outbox_send after insert on public.email_outbox
  for each row execute function public.email_outbox_send();

-- O endereço do app no e-mail (o link da reserva e da enquete): `app_config.app_url`
create function public._app_url()
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select value from public.app_config where key = 'app_url'), 'https://questlist.wavdev.org') $$;

-- O que vai no e-mail de uma reserva: o compromisso no fuso da dona (o .ics leva o instante)
create function public._booking_email(p_booking public.bookings, p_kind text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles;
begin
  select * into v_owner from public.profiles where id = p_booking.owner_id;
  insert into public.email_outbox (kind, to_email, locale, payload)
  values (p_kind, p_booking.guest_email, coalesce(nullif(v_owner.locale, ''), 'pt-BR'), jsonb_build_object(
    'guest', p_booking.guest_name,
    'owner', v_owner.display_name,
    'type_name', p_booking.type_name,
    'starts_at', p_booking.starts_at,
    'ends_at', p_booking.ends_at,
    'timezone', coalesce(nullif(v_owner.timezone, ''), 'America/Sao_Paulo'),
    'cancelled_by', p_booking.cancelled_by,
    'uid', p_booking.token,
    'link', public._app_url() || '/reserva/' || p_booking.token));
end;
$$;

create function public.bookings_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public._booking_email(new, case when new.status = 'pending' then 'booking_pending' else 'booking_confirmed' end);
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      perform public._booking_email(new, 'booking_confirmed');
    elsif new.status = 'declined' then
      perform public._booking_email(new, 'booking_declined');
    elsif new.status = 'cancelled' then
      perform public._booking_email(new, 'booking_cancelled');
    end if;
  elsif new.starts_at is distinct from old.starts_at and new.status in ('pending', 'confirmed') then
    perform public._booking_email(new, 'booking_rescheduled');
  end if;
  return null;
end;
$$;
create trigger bookings_email after insert or update of status, starts_at on public.bookings
  for each row execute function public.bookings_email();

-- Enquete fechada: cada pessoa que deixou e-mail recebe o horário escolhido
create function public.time_polls_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles;
  v_starts timestamptz;
begin
  if new.status <> 'closed' or old.status = 'closed' or new.chosen_slot is null then
    return null;
  end if;
  select * into v_owner from public.profiles where id = new.owner_id;
  select starts_at into v_starts from public.time_poll_slots where id = new.chosen_slot;
  insert into public.email_outbox (kind, to_email, locale, payload)
  select 'poll_closed', v.email, coalesce(nullif(v_owner.locale, ''), 'pt-BR'), jsonb_build_object(
    'guest', v.name,
    'owner', v_owner.display_name,
    'title', new.title,
    'starts_at', v_starts,
    'ends_at', v_starts + make_interval(mins => new.duration_min),
    'timezone', coalesce(nullif(v_owner.timezone, ''), 'America/Sao_Paulo'),
    'could', new.chosen_slot = any (v.slots),
    'uid', 'poll-' || new.token,
    'link', public._app_url() || '/horario/' || new.token)
  from public.time_poll_votes v
  where v.poll_id = new.id and v.email is not null;
  return null;
end;
$$;
create trigger time_polls_email after update of status on public.time_polls
  for each row execute function public.time_polls_email();

-- De novo o que falhou (até 3 tentativas) ou ficou parado (o pg_net perdeu a chamada)
create function public._email_retry()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.email_outbox
    where status <> 'sent' and attempts < 3 and created_at < now() - interval '2 minutes'
      and created_at > now() - interval '1 day'
    order by created_at limit 50
  loop
    perform public._email_post(v_id);
  end loop;
end;
$$;
select cron.schedule('email-retry', '*/10 * * * *', $$select public._email_retry()$$);
select cron.schedule('email-retencao', '39 4 * * *',
  $$delete from public.email_outbox where created_at < now() - interval '30 days'$$);

revoke execute on function public._email_post(uuid), public.email_outbox_send(), public._app_url(),
  public._booking_email(public.bookings, text), public.bookings_email(), public.time_polls_email(),
  public._email_retry() from public, anon, authenticated;

-- A política muda (um terceiro novo, o Resend, recebe o e-mail de quem reserva ou responde): a versão
-- 2026-11-21.2 (enquetes) ainda não saiu, então fica nela
