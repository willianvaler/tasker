-- D254: a foto da nota passa a ser lida pelo Tesseract no próprio servidor, sem ir ao Google.
-- A política de privacidade muda (terceiros): todo mundo aceita de novo (D213).
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-21' $$;
