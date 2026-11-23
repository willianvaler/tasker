-- Estudar (ES7, ESCOPO_V13 §5, D328). **Projeto de estudo:** um interruptor no projeto; ligado, as
-- tarefas abrem a ficha de leitura e a visão geral mostra o que estudar agora. **Onde parei:** a
-- posição de leitura de cada material, por pessoa (a rolagem da anotação, a página do PDF), no
-- servidor (e no cache do aparelho), para continuar em outro aparelho.

alter table public.folders add column study boolean not null default false;
grant update (study) on public.folders to authenticated;

create table public.reading_positions (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  material_id uuid not null references public.project_files (id) on delete cascade,
  -- {"scroll": 0.42} (fração da anotação) ou {"page": 12} (PDF)
  position jsonb not null check (jsonb_typeof(position) = 'object' and pg_column_size(position) < 512),
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);
alter table public.reading_positions enable row level security;
revoke all on public.reading_positions from anon;
revoke insert, update on public.reading_positions from authenticated;
grant insert (user_id, material_id, position, updated_at), update (user_id, material_id, position, updated_at)
  on public.reading_positions to authenticated;
create policy "reading_positions_own" on public.reading_positions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.project_files where id = material_id));

-- Exportar meus dados: as posições de leitura
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
  ) || jsonb_build_object(
    -- V11 (OB11): anotações da pessoa e as versões delas
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notes n
                       where n.user_id = v_user), '[]'),
    'note_versions', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id' order by v.created_at) from public.note_versions v
                               where v.user_id = v_user), '[]'),
    -- OB14: com quem compartilhei (e o que recebi) e o que publiquei (sem o hash da senha)
    'note_shares', coalesce((select jsonb_agg(jsonb_build_object('note_id', s.note_id, 'role', s.role,
                                                                  'mine', s.owner_id = v_user, 'at', s.created_at)
                                              order by s.created_at)
                             from public.note_shares s where s.owner_id = v_user or s.user_id = v_user), '[]'),
    'note_publications', coalesce((select jsonb_agg(to_jsonb(p) - 'owner_id' - 'password_hash' order by p.created_at)
                                   from public.note_publications p where p.owner_id = v_user), '[]'),
    -- V12 (AG1): a disponibilidade da agenda
    'availability_rules', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.weekday, r.starts)
                                    from public.availability_rules r where r.user_id = v_user), '[]'),
    'availability_exceptions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.starts_on)
                                         from public.availability_exceptions x where x.user_id = v_user), '[]'),
    -- AG2: tipos de compromisso e as reservas feitas comigo (com os dados de quem reservou)
    'booking_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at)
                               from public.booking_types t where t.user_id = v_user), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'owner_id' - 'token' order by b.starts_at)
                          from public.bookings b where b.owner_id = v_user), '[]'),
    'time_polls', coalesce((select jsonb_agg(to_jsonb(tp) - 'owner_id' - 'token' || jsonb_build_object(
        'slots', coalesce((select jsonb_agg(s.starts_at order by s.starts_at)
                           from public.time_poll_slots s where s.poll_id = tp.id), '[]'),
        'votes', coalesce((select jsonb_agg(jsonb_build_object('name', v.name, 'email', v.email,
                             'slots', (select coalesce(jsonb_agg(s.starts_at order by s.starts_at), '[]')
                                       from public.time_poll_slots s where s.id = any (v.slots)))
                           order by v.created_at)
                           from public.time_poll_votes v where v.poll_id = tp.id), '[]'))
        order by tp.created_at)
                            from public.time_polls tp where tp.owner_id = v_user), '[]')
  ) || jsonb_build_object(
    'project_files', coalesce((select jsonb_agg(to_jsonb(pf) - 'created_by' order by pf.created_at)
                               from public.project_files pf where pf.created_by = v_user), '[]'),
    'note_images', coalesce((select jsonb_agg(to_jsonb(na) - 'user_id' order by na.created_at)
                             from public.note_assets na where na.user_id = v_user), '[]'),
    'reading_positions', coalesce((select jsonb_agg(to_jsonb(rp) - 'user_id' order by rp.updated_at)
                                   from public.reading_positions rp where rp.user_id = v_user), '[]')
  );
end;
$function$;
