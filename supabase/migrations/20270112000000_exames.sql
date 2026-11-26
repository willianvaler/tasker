-- SA4 (ESCOPO_V15 §5, D389): exames. Cada resultado é uma linha (data, nome, valor, unidade e a
-- faixa de referência que a pessoa digita); o gráfico por exame é conta do app. Sem interpretação:
-- nada aqui diz se está bom ou ruim. Anexo opcional (foto ou PDF) no bucket privado `health`,
-- caminho "<pessoa>/<resultado>.<ext>", que só a dona lê. Dado de saúde (SA0): consentimento
-- `health` para gravar, só a dona vê, sync, exportação, revogar apaga.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health', 'health', false, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null check (day between date '1900-01-01' and current_date + 1),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  value numeric not null check (value between -1e9 and 1e9),
  unit text not null default '' check (char_length(unit) <= 20),
  ref_low numeric check (ref_low between -1e9 and 1e9),
  ref_high numeric check (ref_high between -1e9 and 1e9),
  note text not null default '' check (char_length(note) <= 500),
  file_path text,
  file_mime text check (file_mime in ('image/webp', 'image/jpeg', 'image/png', 'application/pdf')),
  created_at timestamptz not null default now(),
  check (ref_low is null or ref_high is null or ref_low <= ref_high),
  check ((file_path is null) = (file_mime is null))
);
create index exam_results_user on public.exam_results (user_id, name, day);
alter table public.exam_results enable row level security;
revoke all on public.exam_results from anon;
revoke insert, update on public.exam_results from authenticated;
grant insert (id, day, name, value, unit, ref_low, ref_high, note, file_path, file_mime),
      update (day, name, value, unit, ref_low, ref_high, note, file_path, file_mime)
  on public.exam_results to authenticated;
create policy "exam_results_select" on public.exam_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy "exam_results_insert" on public.exam_results for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_sensitive_consent('health'));
create policy "exam_results_update" on public.exam_results for update to authenticated
  using (user_id = (select auth.uid())) with check (public.has_sensitive_consent('health'));
create policy "exam_results_delete" on public.exam_results for delete to authenticated
  using (user_id = (select auth.uid()));

-- O anexo tem de ser o desta linha ("<pessoa>/<resultado>.<ext>"), para a RLS do Storage valer
create function public.exam_results_file()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.file_path is not null
     and new.file_path !~ ('^' || new.user_id::text || '/' || new.id::text || '\.(webp|jpg|png|pdf)$') then
    raise exception 'Caminho do anexo não é o deste exame' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger exam_results_file before insert or update of file_path on public.exam_results
  for each row execute function public.exam_results_file();

-- Trocar, tirar o anexo ou apagar o resultado (também pela conta ou pelo consentimento) manda o
-- arquivo para a fila de limpeza
create function public.exam_results_garbage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.file_path is not null and (tg_op = 'DELETE' or new.file_path is distinct from old.file_path) then
    insert into public.storage_garbage (bucket, path) values ('health', old.file_path) on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger exam_results_garbage after update of file_path or delete on public.exam_results
  for each row execute function public.exam_results_garbage();
revoke execute on function public.exam_results_file(), public.exam_results_garbage() from public, anon, authenticated;

alter publication powersync add table public.exam_results;

-- Arquivos: só a dona, na pasta dela; enviar pede o consentimento
create policy "health: ler" on storage.objects for select to authenticated
  using (bucket_id = 'health' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'health' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.has_sensitive_consent('health'));
create policy "health: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'health' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'health' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.has_sensitive_consent('health'));
create policy "health: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'health' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
  elsif p_purpose = 'health' then
    delete from public.water_logs where user_id = auth.uid();
    delete from public.sleep_logs where user_id = auth.uid();
    delete from public.exam_results where user_id = auth.uid();
    delete from public.health_settings where id = auth.uid();
  end if;
end;
$$;

-- Exportar meus dados: os resultados (os arquivos ficam no Storage, como os anexos)
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
    'exam_results', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.name, x.day)
                              from public.exam_results x where x.user_id = v_user), '[]'),
    'card_reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.reviewed_at)
                              from public.card_reviews r where r.user_id = v_user), '[]'),
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$function$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
