-- F3: o push sai no idioma do aparelho que recebe. Quem usa "idioma do sistema" não tem idioma no
-- perfil (profiles.locale nulo), por isso o aparelho manda o dele ao registrar o token (e de novo
-- quando a pessoa troca o idioma no app). Sem idioma no token, vale o do perfil; sem nenhum, o
-- português.

alter table public.push_tokens
  add column locale text check (locale in ('pt-BR', 'en', 'es'));

drop function public.register_push_token(text, text);

create function public.register_push_token(p_token text, p_platform text, p_locale text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if p_locale is not null and p_locale not in ('pt-BR', 'en', 'es') then
    p_locale := null;
  end if;
  insert into public.push_tokens (user_id, token, platform, locale)
  values (auth.uid(), p_token, p_platform, p_locale)
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, locale = excluded.locale,
        last_seen_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
