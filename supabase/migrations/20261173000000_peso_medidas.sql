-- AC7 (V6 §6, D239): peso corporal e medidas. Dado de saúde é dado pessoal sensível (LGPD art.
-- 11): fica só com a pessoa (nem o treinador vê), só é gravado com o consentimento específico
-- registrado (`sensitive_consents`), entra na exportação e sai com a conta; revogar o
-- consentimento apaga o que foi guardado.

create table public.sensitive_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  purpose text not null check (purpose in ('body_metrics')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index sensitive_consents_active on public.sensitive_consents (user_id, purpose)
  where revoked_at is null;
alter table public.sensitive_consents enable row level security;
revoke all on public.sensitive_consents from anon, authenticated;
grant select on public.sensitive_consents to authenticated;
create policy "sensitive_consents_select" on public.sensitive_consents for select to authenticated
  using (user_id = (select auth.uid()));

create function public.has_sensitive_consent(p_purpose text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.sensitive_consents
                 where user_id = auth.uid() and purpose = p_purpose and revoked_at is null);
$$;

create function public.grant_sensitive_consent(p_purpose text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.sensitive_consents (user_id, purpose) values (auth.uid(), p_purpose)
  on conflict (user_id, purpose) where revoked_at is null do nothing;
end;
$$;

-- Revogar: para de guardar e apaga o que havia (o registro do consentimento fica, com a data)
create function public.revoke_sensitive_consent(p_purpose text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.sensitive_consents set revoked_at = now()
  where user_id = auth.uid() and purpose = p_purpose and revoked_at is null;
  if p_purpose = 'body_metrics' then
    delete from public.body_metrics where user_id = auth.uid();
    delete from public.body_goals where user_id = auth.uid();
  end if;
end;
$$;

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Peso em kg, gordura em %, medidas em cm (a tela converte)
  kind text not null check (kind in ('weight', 'body_fat', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf', 'neck')),
  value numeric(6, 2) not null check (value > 0 and value < 1000),
  measured_on date not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index body_metrics_user_kind on public.body_metrics (user_id, kind, measured_on desc);

create table public.body_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('weight', 'body_fat', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf', 'neck')),
  target numeric(6, 2) not null check (target > 0 and target < 1000),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.body_metrics enable row level security;
alter table public.body_goals enable row level security;
revoke insert, update on public.body_metrics, public.body_goals from anon, authenticated;
revoke all on public.body_metrics, public.body_goals from anon;
grant insert (id, kind, value, measured_on, note), update (value, measured_on, note) on public.body_metrics to authenticated;
grant insert (id, kind, target), update (target) on public.body_goals to authenticated;
create policy "body_metrics_select" on public.body_metrics for select to authenticated
  using (user_id = (select auth.uid()));
create policy "body_metrics_insert" on public.body_metrics for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('body_metrics'));
create policy "body_metrics_update" on public.body_metrics for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('body_metrics'));
create policy "body_metrics_delete" on public.body_metrics for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "body_goals_select" on public.body_goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "body_goals_insert" on public.body_goals for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('body_metrics'));
create policy "body_goals_update" on public.body_goals for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('body_metrics'));
create policy "body_goals_delete" on public.body_goals for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.body_goals_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger body_goals_touch before update on public.body_goals
  for each row execute function public.body_goals_touch();

alter publication powersync add table public.body_metrics, public.body_goals, public.sensitive_consents;

revoke execute on function public.grant_sensitive_consent(text), public.revoke_sensitive_consent(text),
  public.has_sensitive_consent(text) from public, anon;
grant execute on function public.grant_sensitive_consent(text), public.revoke_sensitive_consent(text),
  public.has_sensitive_consent(text) to authenticated;

-- Exportação com os dados de corpo
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
