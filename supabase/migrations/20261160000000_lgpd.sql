-- V5 §4 (LGPD; D213): termos de uso, registro do consentimento e pedidos do titular.
--
-- Uma versão para os termos e a política (`legal_version()`, espelho de LEGAL_VERSION em
-- src/content/legal.ts). O aceite fica em `consents`, só acrescentado (versão, data e de onde veio):
-- no cadastro pelo handle_new_user (o formulário manda `accepted_terms` nos metadados) e, quando a
-- versão muda, pela tela de aceite (`accept_terms`). Pedidos do titular (acesso, correção,
-- portabilidade, eliminação, outro) em `data_requests`, com prazo de resposta de 15 dias.

create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-19' $$;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  source text not null check (source in ('signup', 'update')),
  accepted_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, accepted_at desc);
alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
create policy "consents_select" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('access', 'correction', 'portability', 'deletion', 'other')),
  message text not null default '' check (char_length(message) <= 2000),
  status text not null default 'open' check (status in ('open', 'answered')),
  answer text,
  created_at timestamptz not null default now(),
  -- Prazo de resposta (LGPD art. 19, II: 15 dias)
  due_at timestamptz not null default now() + interval '15 days',
  answered_at timestamptz
);
create index data_requests_user_idx on public.data_requests (user_id, created_at desc);
create index data_requests_open_idx on public.data_requests (due_at) where status = 'open';
alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon, authenticated;
grant select on public.data_requests to authenticated;
create policy "data_requests_select" on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()));

-- Versão aceita por último e a vigente: o app pede o aceite quando são diferentes.
create function public.consent_status()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'current', public.legal_version(),
    'accepted', (select version from public.consents where user_id = auth.uid()
                 order by accepted_at desc limit 1),
    'accepted_at', (select accepted_at from public.consents where user_id = auth.uid()
                    order by accepted_at desc limit 1)
  );
$$;

create function public.accept_terms(p_version text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  -- Aceita a versão que a pessoa viu; se o texto mudou no meio, ela vê o novo antes
  if p_version is distinct from public.legal_version() then
    raise exception 'Os termos mudaram: leia a versão nova' using errcode = '22023';
  end if;
  insert into public.consents (user_id, version, source) values (auth.uid(), p_version, 'update');
end;
$$;

create function public.request_data_action(p_kind text, p_message text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  -- Um pedido aberto do mesmo tipo por vez (evita repetição por toque duplo)
  if exists (select 1 from public.data_requests where user_id = auth.uid() and kind = p_kind and status = 'open') then
    raise exception 'Já existe um pedido desse tipo em aberto' using errcode = '22023';
  end if;
  insert into public.data_requests (user_id, kind, message)
  values (auth.uid(), p_kind, left(coalesce(trim(p_message), ''), 2000))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.consent_status() from public, anon;
revoke execute on function public.accept_terms(text) from public, anon;
revoke execute on function public.request_data_action(text, text) from public, anon;
grant execute on function public.consent_status() to authenticated;
grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.request_data_action(text, text) to authenticated;

-- Contas de antes desta versão: aceitam pela tela de aceite ao abrir o app (sem registro aqui)

create or replace function public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_folder_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 50)
  );

  -- Aceite dos termos no cadastro (V5 §4, D213): o formulário só envia com a caixa marcada
  if (new.raw_user_meta_data ->> 'accepted_terms') is not null then
    insert into public.consents (user_id, version, source)
    values (new.id, public.legal_version(), 'signup');
  end if;

  insert into public.folders (owner_id, name, icon, is_inbox)
  values (new.id, 'Caixa de entrada', '📥', true)
  returning id into v_folder_id;

  insert into public.pages (folder_id, name, icon, is_inbox)
  values (v_folder_id, 'Caixa de entrada', '📥', true);

  insert into public.pages (folder_id, name, icon, view_type, is_habits)
  values (v_folder_id, 'Hábitos', '🔥', 'habits', true);

  return new;
end;
$function$;

create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;
