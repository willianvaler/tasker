-- Conflito de edição nas anotações (ED6, ESCOPO_V16, D348). Duas edições da mesma anotação sem
-- internet: a que chega por último vence no texto, mas a que ela substituiria não some. Cada
-- gravação do texto traz `body_base`, o SHA-256 do texto em que a edição começou; se o texto do
-- servidor já é outro (alguém gravou no meio), o texto de antes vai para `note_conflicts`, e a
-- anotação mostra o aviso para mesclar por bloco, ver ou descartar. Sem `body_base` (versão antiga do
-- app), nada muda.

alter table public.notes add column body_base text check (body_base is null or body_base ~ '^[0-9a-f]{64}$');
grant update (body_base) on public.notes to authenticated;

create table public.note_conflicts (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  title text not null default '',
  -- O texto que foi substituído (de outro aparelho ou de outra pessoa)
  body text not null,
  replaced_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index note_conflicts_note on public.note_conflicts (note_id, created_at desc);
alter table public.note_conflicts enable row level security;
revoke all on public.note_conflicts from anon, authenticated;
grant select, delete on public.note_conflicts to authenticated;
create policy "note_conflicts_select" on public.note_conflicts for select to authenticated
  using (public.can_see_note(note_id));
create policy "note_conflicts_delete" on public.note_conflicts for delete to authenticated
  using (public.can_edit_note(note_id));

create function public.notes_conflict()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.body_base is not null and new.body is distinct from old.body
     and encode(sha256(convert_to(old.body, 'UTF8')), 'hex') <> new.body_base then
    insert into public.note_conflicts (note_id, title, body) values (old.id, old.title, old.body);
    -- Guarda as 20 mais novas por anotação
    delete from public.note_conflicts
    where note_id = old.id and id not in (
      select id from public.note_conflicts where note_id = old.id order by created_at desc limit 20);
  end if;
  new.body_base := null;
  return new;
end;
$$;
create trigger notes_conflict before update of body, body_base on public.notes
  for each row execute function public.notes_conflict();
revoke execute on function public.notes_conflict() from public, anon, authenticated;

alter publication supabase_realtime add table public.note_conflicts;
