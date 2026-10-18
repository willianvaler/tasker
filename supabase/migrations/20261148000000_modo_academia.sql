-- V6 §15.1 e §15.2 (AC1.1, AC1.5): modo academia da conta e preferências da interface.
-- gym_enabled: null = ainda não respondeu "Vai usar para treinar?"; muda só por set_gym_mode,
-- que também cria a pasta de sistema Academia (uma por conta, is_gym).
-- ui_prefs: preferências de interface que valem em todos os aparelhos (ex.: { "sidebar": { "order":
-- [...], "hidden": [...] } }). O formato é do app; o banco só garante objeto e tamanho.

alter table public.profiles
  add column gym_enabled boolean,
  add column ui_prefs jsonb not null default '{}'::jsonb
    constraint profiles_ui_prefs_object check (jsonb_typeof(ui_prefs) = 'object' and pg_column_size(ui_prefs) <= 4096);

grant update (ui_prefs) on public.profiles to authenticated;

alter table public.folders add column is_gym boolean not null default false;
create unique index folders_one_gym_per_owner on public.folders (owner_id) where is_gym;

-- A Academia é sempre pasta pessoal na raiz: não vira projeto nem subpasta
create function public.folders_gym_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.is_gym and (new.kind <> 'folder' or new.parent_id is not null) then
    raise exception 'A pasta Academia não pode virar projeto nem subpasta' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger folders_gym_guard
  before update of kind, parent_id on public.folders
  for each row execute function public.folders_gym_guard();

revoke execute on function public.folders_gym_guard() from public, anon, authenticated;

-- Liga ou desliga o modo academia. Ligar cria a pasta Academia se ela não existir (ou se foi
-- apagada); desligar não apaga nada. Devolve o id da pasta (null se desligou e não há pasta).
create function public.set_gym_mode(p_enabled boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_locale text;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  update public.profiles set gym_enabled = coalesce(p_enabled, false) where id = v_uid
  returning locale into v_locale;

  select id into v_id from public.folders where owner_id = v_uid and is_gym;
  if v_id is null and p_enabled then
    insert into public.folders (owner_id, name, icon, kind, is_gym, position)
    values (
      v_uid,
      case when v_locale like 'en%' then 'Gym' when v_locale like 'es%' then 'Gimnasio' else 'Academia' end,
      'lucide:dumbbell',
      'folder',
      true,
      coalesce((select max(position) from public.folders
                where owner_id = v_uid and parent_id is null), 0) + 1
    )
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.set_gym_mode(boolean) from public, anon;
grant execute on function public.set_gym_mode(boolean) to authenticated;
