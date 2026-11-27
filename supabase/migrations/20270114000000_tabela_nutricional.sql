-- SA5 (ESCOPO_V15 §5, D391): receitas, compras e macros. A receita é uma anotação com propriedades
-- (porções e ingredientes), sem tabela nova; juntar na lista de compras e somar os macros são conta
-- do app. O que é novo é a **tabela nutricional da própria pessoa**: cada alimento com os valores
-- por 100 g, por 100 mL ou por unidade, digitados ou importados de CSV. Não há base nutricional de
-- fora (V15 §10). Só a dona vê; vai pelo sync e pela exportação.

create table public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  basis text not null default 'g' check (basis in ('g', 'ml', 'un')),
  kcal numeric not null default 0 check (kcal between 0 and 100000),
  protein numeric not null default 0 check (protein between 0 and 100000),
  carbs numeric not null default 0 check (carbs between 0 and 100000),
  fat numeric not null default 0 check (fat between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nutrition_foods_user on public.nutrition_foods (user_id, name);

create function public.nutrition_foods_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger nutrition_foods_touch before insert or update on public.nutrition_foods
  for each row execute function public.nutrition_foods_touch();

alter table public.nutrition_foods enable row level security;
revoke all on public.nutrition_foods from anon;
revoke insert, update on public.nutrition_foods from authenticated;
grant insert (id, name, basis, kcal, protein, carbs, fat),
      update (name, basis, kcal, protein, carbs, fat)
  on public.nutrition_foods to authenticated;
create policy "nutrition_foods_select" on public.nutrition_foods for select to authenticated
  using (user_id = (select auth.uid()));
create policy "nutrition_foods_insert" on public.nutrition_foods for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "nutrition_foods_update" on public.nutrition_foods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "nutrition_foods_delete" on public.nutrition_foods for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication powersync add table public.nutrition_foods;

-- Exportar meus dados: a tabela nutricional
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
    'nutrition_foods', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.name)
                                 from public.nutrition_foods n where n.user_id = v_user), '[]'),
    'card_reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.reviewed_at)
                              from public.card_reviews r where r.user_id = v_user), '[]'),
    'sensitive_releases', coalesce((select jsonb_agg(jsonb_build_object('field', r.field, 'at', r.created_at))
                                    from public.sensitive_releases r where r.user_id = v_user), '[]'));
end;
$function$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
