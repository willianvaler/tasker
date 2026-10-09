-- Fase 6: notificações push no celular (expo-notifications). A notificação in-app (Fase 4) continua
-- sendo a fonte; quando nasce uma, o banco chama a Edge Function "push" (pg_net), que manda para os
-- aparelhos do usuário pela API da Expo.
--
-- O endereço e o segredo da função ficam em app_config (fora do alcance do cliente). Sem eles, nada
-- é enviado: em desenvolvimento local, a fila de pg_net só recebe chamadas se alguém configurar
-- (D58). Em produção: insert into app_config values ('push_url', 'https://<proj>.supabase.co/functions/v1/push'),
-- ('push_secret', '<o mesmo PUSH_WEBHOOK_SECRET da função>').

create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) between 10 and 300),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;
create policy "push_tokens_select" on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_tokens_delete" on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- O aparelho é de quem está logado agora (troca de conta no mesmo celular move o token)
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.push_tokens (user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, last_seen_at = now();
end;
$$;

create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

create function public.notifications_send_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select value from public.app_config where key = 'push_url');
  v_secret text := (select value from public.app_config where key = 'push_secret');
begin
  if v_url is null or v_secret is null
     or not exists (select 1 from public.push_tokens where user_id = new.user_id) then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
  return null;
end;
$$;

create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.notifications_send_push();

revoke execute on function public.notifications_send_push() from public, anon, authenticated;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
