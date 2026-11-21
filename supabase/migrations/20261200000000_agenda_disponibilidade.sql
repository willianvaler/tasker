-- AG1 (D310, ESCOPO_V12 §1): disponibilidade da agenda. Os horários em que a pessoa aceita
-- compromissos, por dia da semana, no fuso do perfil, e as exceções por data (folga, viagem, um
-- trecho do dia). Só a dona vê e muda; quem reservar (AG2) e o "achar horário" (AG3) vão ler isto
-- por RPCs security definer que devolvem só os horários livres, nunca as linhas. Configurar pede
-- conexão: fica fora do sync (D86 não se aplica).

-- Semana: um trecho por linha (seg 9:00–12:00, seg 14:00–18:00...). Dia ISO: 1 = segunda, 7 = domingo.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts time(0) not null,
  ends time(0) not null,
  created_at timestamptz not null default now(),
  check (starts < ends)
);
create index availability_rules_user on public.availability_rules (user_id, weekday, starts);

-- Exceção: bloqueia os dias de starts_on a ends_on inteiros (sem horário) ou só o trecho
-- starts–ends em cada um deles.
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  starts time(0),
  ends time(0),
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366),
  check ((starts is null and ends is null) or (starts is not null and ends is not null and starts < ends))
);
create index availability_exceptions_user on public.availability_exceptions (user_id, ends_on);

alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
revoke all on public.availability_rules, public.availability_exceptions from anon;
revoke insert, update on public.availability_rules, public.availability_exceptions from authenticated;
-- A semana muda inteira pelo set_availability (confere sobreposição); não há update de trecho
grant insert (id, weekday, starts, ends) on public.availability_rules to authenticated;
grant insert (id, starts_on, ends_on, starts, ends, note),
  update (starts_on, ends_on, starts, ends, note) on public.availability_exceptions to authenticated;

create policy "availability_rules_select" on public.availability_rules for select to authenticated
  using (user_id = (select auth.uid()));
create policy "availability_rules_insert" on public.availability_rules for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "availability_rules_delete" on public.availability_rules for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "availability_exceptions_select" on public.availability_exceptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "availability_exceptions_insert" on public.availability_exceptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "availability_exceptions_update" on public.availability_exceptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "availability_exceptions_delete" on public.availability_exceptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Até 12 meses de exceções guardadas por pessoa (as passadas o app esconde) e 100 de uma vez
create function public.availability_exceptions_limit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.availability_exceptions
      where user_id = new.user_id and ends_on >= current_date) >= 100 then
    raise exception 'Exceções demais na agenda' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger availability_exceptions_limit before insert on public.availability_exceptions
  for each row execute function public.availability_exceptions_limit();

-- Troca a semana inteira de uma vez: [{ "weekday": 1, "starts": "09:00", "ends": "12:00" }, ...].
-- Sobreposição no mesmo dia é recusada (o app junta antes; aqui é a garantia). Roda como quem
-- chama (RLS vale), então só mexe nas linhas da própria pessoa.
create function public.set_availability(p_rules jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) > 70 then
    raise exception 'Semana inválida' using errcode = '22023';
  end if;
  if exists (
    with r as (
      select (e.v ->> 'weekday')::smallint as weekday, (e.v ->> 'starts')::time as starts,
             (e.v ->> 'ends')::time as ends, e.n
      from jsonb_array_elements(p_rules) with ordinality as e(v, n)
    )
    select 1 from r a join r b on a.weekday = b.weekday and a.n < b.n
    where a.starts < b.ends and b.starts < a.ends
  ) then
    raise exception 'Horários se sobrepõem no mesmo dia' using errcode = '23514';
  end if;
  delete from public.availability_rules where user_id = v_user;
  insert into public.availability_rules (weekday, starts, ends)
  select (e ->> 'weekday')::smallint, (e ->> 'starts')::time, (e ->> 'ends')::time
  from jsonb_array_elements(p_rules) e;
end;
$$;
revoke execute on function public.set_availability(jsonb) from public, anon;
grant execute on function public.set_availability(jsonb) to authenticated;

-- Exportação com a disponibilidade
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
                                         from public.availability_exceptions x where x.user_id = v_user), '[]')
  );
end;
$function$;

