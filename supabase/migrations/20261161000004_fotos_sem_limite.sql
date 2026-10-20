-- V9-3 (dono, 19/10): sem limite de leituras de foto por conta enquanto for teste. Limite nulo
-- = sem limite; para voltar a limitar, uma migração que devolva o número (a Edge Function e o
-- photo_reads_left já tratam os dois casos). O plano gratuito do Gemini continua limitando por minuto.
create or replace function public.photo_read_limit()
returns integer
language sql immutable set search_path = ''
as $$ select null::integer $$;

create or replace function public.photo_reads_left()
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when public.photo_read_limit() is null then null
    else greatest(0, public.photo_read_limit() - (
      select count(*)::integer from public.photo_reads r
      where r.user_id = auth.uid() and r.ok
        and r.created_at >= date_trunc('month', now())
    )) end;
$$;
