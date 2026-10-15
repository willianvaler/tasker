-- W3: anotações gerais, de texto simples. São só de quem escreveu (nada de compartilhar por
-- enquanto): escrita direta com RLS, também sem internet pelo sync.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user on public.notes (user_id, updated_at desc);

create function public.notes_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger notes_touch before update on public.notes
  for each row execute function public.notes_touch();

alter table public.notes enable row level security;
create policy "notes: as minhas" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke insert, update on public.notes from anon, authenticated;
grant insert (id, title, body, pinned), update (title, body, pinned) on public.notes to authenticated;
alter publication powersync add table public.notes;
