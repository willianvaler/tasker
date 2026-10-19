-- ESCOPO_V9 (GA4): a política de privacidade passa a citar o Google (API Gemini) como quem lê
-- as fotos de notas e listas, no plano gratuito. Terceiro novo: todo mundo aceita de novo (D213).
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-19-2' $$;
