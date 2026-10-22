-- BE4 (D270): remédios no Bem-estar. Quais remédios a pessoa compra, quantos comprimidos tem,
-- quanto toma (comprimidos por vez, vezes por dia, a cada quantos dias) e quanto falta para acabar.
-- O saldo é uma conta do app (`lib/medications.ts`) a partir da última contagem (`stock` em
-- `stock_on`): comprar ou contar de novo grava uma contagem nova. Remédio é dado de saúde, sensível
-- (LGPD art. 11), como o peso (D239): só com o consentimento específico, só a pessoa vê, revogar
-- apaga, entra na exportação e sai com a conta.

alter table public.sensitive_consents drop constraint sensitive_consents_purpose_check;
alter table public.sensitive_consents add constraint sensitive_consents_purpose_check
  check (purpose in ('body_metrics', 'medications'));

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Comprimidos por vez (aceita meio), vezes por dia e a cada quantos dias (1 = todo dia)
  dose numeric(6, 2) not null default 1 check (dose > 0 and dose <= 100),
  times_per_day smallint not null default 1 check (times_per_day between 1 and 24),
  every_days smallint not null default 1 check (every_days between 1 and 90),
  -- Comprimidos por caixa: o "Comprei" sugere esse número
  pack_size integer check (pack_size between 1 and 10000),
  -- Última contagem: quantos havia no dia `stock_on` (as doses contam a partir do dia seguinte)
  stock numeric(8, 2) not null default 0 check (stock >= 0 and stock < 1000000),
  stock_on date not null,
  -- Parado: não desconta (ao parar, o app grava o que sobrou como contagem)
  paused boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index medications_user on public.medications (user_id, created_at);

alter table public.medications enable row level security;
revoke all on public.medications from anon;
revoke insert, update on public.medications from authenticated;
grant insert (id, name, dose, times_per_day, every_days, pack_size, stock, stock_on, paused, notes),
  update (name, dose, times_per_day, every_days, pack_size, stock, stock_on, paused, notes)
  on public.medications to authenticated;
create policy "medications_select" on public.medications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "medications_insert" on public.medications for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('medications'));
create policy "medications_update" on public.medications for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('medications'));
create policy "medications_delete" on public.medications for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.medications_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger medications_touch before update on public.medications
  for each row execute function public.medications_touch();

alter publication powersync add table public.medications;

-- Revogar: para de guardar e apaga o que havia (o registro do consentimento fica, com a data)
create or replace function public.revoke_sensitive_consent(p_purpose text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.sensitive_consents set revoked_at = now()
  where user_id = auth.uid() and purpose = p_purpose and revoked_at is null;
  if p_purpose = 'body_metrics' then
    delete from public.body_metrics where user_id = auth.uid();
    delete from public.body_goals where user_id = auth.uid();
  elsif p_purpose = 'medications' then
    delete from public.medications where user_id = auth.uid();
  end if;
end;
$$;

-- A política de privacidade muda (dado de saúde novo): todo mundo aceita de novo (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-22' $$;

-- Exportação com os remédios
CREATE OR REPLACE FUNCTION public.export_my_data()
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
    -- V10: amigos (nick e desde quando) e o link de amizade
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', f.username, 'status', f.status, 'since', f.since))
                         from public.my_friends() f), '[]'),
    -- V10 §4: o que publiquei na comunidade (com a cópia), curtidas e denúncias
    'community_posts', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
                                 from public.community_posts c where c.author_id = v_user), '[]'),
    'community_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'at', l.created_at))
                                 from public.community_likes l where l.user_id = v_user), '[]'),
    'community_reports', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id')
                                   from public.community_reports r where r.user_id = v_user), '[]'),
    -- V6: peso e medidas (dado sensível, AC7) e o consentimento dado para eles
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id' order by b.kind, b.measured_on)
                              from public.body_metrics b where b.user_id = v_user), '[]'),
    'body_goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.body_goals g
                            where g.user_id = v_user), '[]'),
    -- Bem-estar: remédios (dado de saúde, sensível, BE4)
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.created_at)
                             from public.medications m where m.user_id = v_user), '[]'),
    'sensitive_consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.granted_at)
                                    from public.sensitive_consents c where c.user_id = v_user), '[]'),
    -- V6: o diário de treino (AC4)
    'workout_sets', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.performed_at)
                              from public.workout_sets w where w.user_id = v_user), '[]'),
    -- V6: exercícios próprios
    'user_exercises', coalesce((select jsonb_agg(to_jsonb(u) - 'owner_id' order by u.created_at)
                                from public.user_exercises u where u.owner_id = v_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;
