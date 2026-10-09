-- Fase 6: onboarding guiado (3 passos), uma vez por conta.
-- Contas que já existiam não veem. Quem entra por convite (projeto ou clã) também não: já chega
-- dentro de um contexto, e a introdução por cima atrapalharia o "Sou @nome".

alter table public.profiles add column onboarded_at timestamptz;
update public.profiles set onboarded_at = now() where onboarded_at is null;
grant update (onboarded_at) on public.profiles to authenticated;

create function public.profiles_mark_onboarded()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set onboarded_at = now() where id = new.user_id and onboarded_at is null;
  return null;
end;
$$;

create trigger folder_members_mark_onboarded
  after insert on public.folder_members
  for each row when (new.role <> 'owner')
  execute function public.profiles_mark_onboarded();

create trigger clan_members_mark_onboarded
  after insert on public.clan_members
  for each row when (new.role <> 'owner')
  execute function public.profiles_mark_onboarded();

revoke execute on function public.profiles_mark_onboarded() from public, anon, authenticated;
