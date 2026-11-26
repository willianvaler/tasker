-- ET1 (ESCOPO_V15 §6, D386): repetição espaçada. Uma linha `pergunta ?:: resposta` numa anotação vira
-- um cartão; a tabela `cards` é refeita por trigger a cada gravação do texto, como a `links` (OB1),
-- e o cartão some quando a linha é apagada. As revisões ficam num log só de inserção
-- (`card_reviews`: cartão, nota 0–5, dia e horário) e o estado de cada cartão (intervalo,
-- facilidade, próxima revisão) é derivado desse log em ordem de horário, então revisar em dois
-- aparelhos fora de ordem dá o mesmo estado (V15-9: SM-2 modificado). Espelho: `src/lib/srs.ts`.
-- Nada daqui dá XP (ET2 decide isso no servidor).

-- O id do cartão vem da anotação e da pergunta (e de quantas vezes a mesma pergunta já apareceu
-- antes nela): mudar só a resposta ou a ordem das linhas mantém o histórico; mudar a pergunta
-- começa um cartão novo.
create table public.cards (
  id uuid primary key,
  note_id uuid not null references public.notes (id) on delete cascade,
  -- A dona da anotação e a pasta dela: vê quem vê a anotação (a mesma regra dos links)
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null check (char_length(answer) between 1 and 2000),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index cards_note on public.cards (note_id);
create index cards_folder on public.cards (folder_id) where folder_id is not null;
create index cards_user on public.cards (user_id) where folder_id is null;

alter table public.cards enable row level security;
create policy "cards_select" on public.cards for select to authenticated
  using ((folder_id is null and (user_id = (select auth.uid()) or public._note_shared(note_id, false)))
         or (folder_id is not null and public.is_folder_member(folder_id, 'viewer')));
-- Só o trigger grava
revoke insert, update, delete on public.cards from anon, authenticated;

create function public._refresh_cards(p_note uuid, p_user uuid, p_folder uuid, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_line text;
  v_at int;
  v_q text;
  v_a text;
  v_fence boolean := false;
  v_pos int := 0;
  v_ids uuid[] := '{}';
  v_seen text[] := '{}';
  v_id uuid;
begin
  if p_text is not null and position('?::' in p_text) > 0 then
    foreach v_line in array string_to_array(p_text, E'\n') loop
      -- Dentro de bloco de código não vale
      if v_line ~ '^\s*(```|~~~)' then
        v_fence := not v_fence;
        continue;
      end if;
      continue when v_fence;
      v_at := position('?::' in v_line);
      continue when v_at = 0;
      -- Sem o começo de lista, citação ou título
      v_q := trim(regexp_replace(left(v_line, v_at - 1),
                                 '^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+|>\s*)', ''));
      v_a := trim(substr(v_line, v_at + 3));
      continue when v_q = '' or v_a = '';
      v_pos := v_pos + 1;
      exit when v_pos > 2000;
      v_seen := v_seen || v_q;
      v_id := md5(p_note::text || '|' || v_q || '|' ||
                  (select count(*) from unnest(v_seen) s where s = v_q))::uuid;
      v_ids := v_ids || v_id;
      insert into public.cards (id, note_id, user_id, folder_id, question, answer, position)
      values (v_id, p_note, p_user, p_folder, left(v_q, 1000), left(v_a, 2000), v_pos)
      on conflict (id) do update
        set question = excluded.question, answer = excluded.answer, position = excluded.position,
            user_id = excluded.user_id, folder_id = excluded.folder_id
        where (public.cards.answer, public.cards.position, public.cards.folder_id, public.cards.user_id)
              is distinct from (excluded.answer, excluded.position, excluded.folder_id, excluded.user_id);
    end loop;
  end if;
  -- A linha apagada leva o cartão (e, em cascata, as revisões dele)
  delete from public.cards where note_id = p_note and id <> all (v_ids);
end;
$$;
revoke execute on function public._refresh_cards(uuid, uuid, uuid, text) from public, anon, authenticated;

create function public.notes_cards()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Quase toda anotação não tem cartão: não paga nada
  if tg_op = 'INSERT' and position('?::' in new.body) = 0 then
    return null;
  end if;
  if tg_op = 'UPDATE' and position('?::' in new.body) = 0 and position('?::' in old.body) = 0 then
    return null;
  end if;
  perform public._refresh_cards(new.id, new.user_id, new.folder_id, new.body);
  return null;
end;
$$;
create trigger notes_cards after insert or update of body, folder_id, user_id on public.notes
  for each row execute function public.notes_cards();

-- Revisões: só inserir (nada de mudar nem apagar). O id, o dia e o horário vêm do aparelho, para
-- a revisão feita sem internet entrar no lugar certo da ordem.
create table public.card_reviews (
  id uuid primary key,
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  grade smallint not null check (grade between 0 and 5),
  day date not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index card_reviews_card on public.card_reviews (user_id, card_id, reviewed_at);

alter table public.card_reviews enable row level security;
revoke all on public.card_reviews from anon;
revoke insert, update, delete on public.card_reviews from authenticated;
grant insert (id, card_id, grade, day, reviewed_at) on public.card_reviews to authenticated;
create policy "card_reviews_select" on public.card_reviews for select to authenticated
  using (user_id = (select auth.uid()));
-- Só no cartão que a pessoa vê (a policy do cartão vale dentro do exists)
create policy "card_reviews_insert" on public.card_reviews for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.cards c where c.id = card_id));

-- Estado de cada cartão por pessoa, refeito do log a cada revisão. A facilidade é guardada em
-- centésimos (250 = 2,5) para a conta ser exata e igual à do app.
create table public.card_states (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  reps int not null,
  lapses int not null,
  ease int not null,
  interval_days int not null,
  due date not null,
  last_day date not null,
  reviews int not null,
  primary key (user_id, card_id)
);
alter table public.card_states enable row level security;
revoke insert, update, delete on public.card_states from anon, authenticated;
create policy "card_states_select" on public.card_states for select to authenticated
  using (user_id = (select auth.uid()));

-- SM-2 modificado (V15-9), o mesmo de `lib/srs.ts`:
--  - facilidade começa em 2,5 e muda pela fórmula do SM-2 (q=5 +0,10; 4 0; 3 −0,14), nunca abaixo de 1,3;
--  - errar (nota < 3) volta as repetições a 0, o intervalo a 1 dia e tira no máximo 0,20 da
--    facilidade (no SM-2 original tirava até 0,80, e o cartão difícil não saía mais do lugar);
--  - acertar: 1 dia, depois 6, depois o intervalo anterior × facilidade (arredondado, sempre pelo
--    menos 1 dia a mais), até 3650 dias.
create function public._card_state(p_user uuid, p_card uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_reps int := 0;
  v_lapses int := 0;
  v_ease int := 250;
  v_interval int := 0;
  v_last date;
  v_n int := 0;
  v_delta int;
begin
  for r in
    select grade, day from public.card_reviews
    where user_id = p_user and card_id = p_card
    order by reviewed_at, id
  loop
    v_n := v_n + 1;
    v_last := r.day;
    v_delta := 10 - (5 - r.grade) * (8 + (5 - r.grade) * 2);
    if r.grade < 3 then
      v_ease := greatest(130, v_ease + greatest(v_delta, -20));
      v_reps := 0;
      v_lapses := v_lapses + 1;
      v_interval := 1;
    else
      v_ease := greatest(130, v_ease + v_delta);
      v_reps := v_reps + 1;
      v_interval := case v_reps
        when 1 then 1
        when 2 then 6
        else least(3650, greatest(v_interval + 1, (v_interval * v_ease + 50) / 100))
      end;
    end if;
  end loop;
  if v_n = 0 then
    delete from public.card_states where user_id = p_user and card_id = p_card;
    return;
  end if;
  insert into public.card_states (user_id, card_id, reps, lapses, ease, interval_days, due, last_day, reviews)
  values (p_user, p_card, v_reps, v_lapses, v_ease, v_interval, v_last + v_interval, v_last, v_n)
  on conflict (user_id, card_id) do update
    set reps = excluded.reps, lapses = excluded.lapses, ease = excluded.ease,
        interval_days = excluded.interval_days, due = excluded.due, last_day = excluded.last_day,
        reviews = excluded.reviews;
end;
$$;
revoke execute on function public._card_state(uuid, uuid) from public, anon, authenticated;

create function public.card_reviews_state()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._card_state(new.user_id, new.card_id);
  return null;
end;
$$;
create trigger card_reviews_state after insert on public.card_reviews
  for each row execute function public.card_reviews_state();

-- O que já foi escrito antes desta migração
select public._refresh_cards(id, user_id, folder_id, body) from public.notes where body like '%?::%';

alter publication powersync add table public.cards, public.card_reviews;

-- As revisões entram na exportação
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return public._export_my_data_base() || jsonb_build_object(
    'equipments', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.equipments e
                            where e.user_id = v_user), '[]'),
    'maintenance_plans', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.maintenance_plans m
                                   where m.user_id = v_user), '[]'),
    -- Saúde (SA0, SA2): o que a pessoa anota e os campos sensíveis que liberou para webhooks
    'health_settings', (select to_jsonb(h) - 'id' from public.health_settings h where h.id = v_user),
    'water_logs', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.logged_at)
                            from public.water_logs w where w.user_id = v_user), '[]'),
    'sleep_logs', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.day, s.bed_time)
                            from public.sleep_logs s where s.user_id = v_user), '[]'),
    -- Medicamentos (SA3): o histórico de cada dose
    'medication_intakes', coalesce((select jsonb_agg(to_jsonb(i) - 'user_id' order by i.day, i.slot)
                                    from public.medication_intakes i where i.user_id = v_user), '[]'),
    -- Repetição espaçada (ET1): as revisões (os cartões estão no texto das anotações)
    'card_reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.reviewed_at)
                              from public.card_reviews r where r.user_id = v_user), '[]'),
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
