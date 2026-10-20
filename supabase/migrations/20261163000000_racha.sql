-- PB5 (V3 §6 B, V9 §6, D225): racha de contas nos gastos do projeto.
-- `split_among` = quem divide aquele gasto (lista de ids, partes iguais). Gasto de saída num projeto
-- com mais de uma pessoa nasce dividido entre todos os membros; o painel tira ou põe gente.
-- Acerto (`kind = 'settle'`): quem pagou (`paid_by`) deu o valor a uma pessoa (o único id de
-- `split_among`). Acerto não é gasto nem entrada: fica fora dos totais. A conta de quem deve a quem
-- é do app (`lib/split.ts`), sobre os lançamentos que todo mundo do projeto já vê.

alter table public.expenses drop constraint expenses_kind_check;
alter table public.expenses add constraint expenses_kind_check check (kind in ('out', 'in', 'settle'));

alter table public.expenses add column split_among jsonb
  check (split_among is null or (jsonb_typeof(split_among) = 'array' and jsonb_array_length(split_among) <= 100));
grant insert (split_among), update (split_among) on public.expenses to authenticated;

create or replace function public.expenses_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type text;
  v_root uuid;
begin
  select p.folder_id, p.view_type::text into new.folder_id, v_type
  from public.pages p where p.id = new.page_id;
  if v_type is distinct from 'expenses' then
    raise exception 'Gastos só numa página de gastos' using errcode = '22023';
  end if;
  v_root := public.folder_root(new.folder_id);
  if new.task_id is not null and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id)
     and not exists (
       select 1 from public.tasks t
       where t.id = new.task_id and public.folder_root(t.folder_id) = v_root
     ) then
    raise exception 'A tarefa ligada tem de ser do mesmo projeto' using errcode = '22023';
  end if;
  if new.paid_by is not null and (tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by)
     and not exists (
       select 1 from public.folder_members m where m.folder_id = v_root and m.user_id = new.paid_by
     ) then
    raise exception 'Quem pagou tem de ser do projeto' using errcode = '22023';
  end if;

  -- Racha: saída nova num projeto com mais de uma pessoa nasce dividida entre todos
  if tg_op = 'INSERT' and new.kind = 'out' and new.split_among is null
     and (select count(*) from public.folder_members m where m.folder_id = v_root) > 1 then
    new.split_among := (select jsonb_agg(m.user_id order by m.joined_at, m.user_id)
                        from public.folder_members m where m.folder_id = v_root);
  end if;
  if new.split_among is not null and new.kind = 'in' then
    new.split_among := null;
  end if;
  -- Lista vazia = não divide (o mesmo que nulo)
  if new.split_among = '[]'::jsonb then
    new.split_among := null;
  end if;
  if new.split_among is not null
     and (tg_op = 'INSERT' or new.split_among is distinct from old.split_among) then
    if exists (
      select 1 from jsonb_array_elements(new.split_among) e
      where jsonb_typeof(e) <> 'string'
         or (e #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (select 1 from public.folder_members m
                        where m.folder_id = v_root and m.user_id = (e #>> '{}')::uuid)
    ) then
      raise exception 'Quem divide tem de ser do projeto' using errcode = '22023';
    end if;
    -- Sem repetidos
    if (select count(distinct e) from jsonb_array_elements(new.split_among) e)
       <> jsonb_array_length(new.split_among) then
      raise exception 'Pessoa repetida na divisão' using errcode = '22023';
    end if;
  end if;
  -- Acerto: de alguém (paid_by) para uma outra pessoa
  if new.kind = 'settle' and (
       new.paid_by is null or new.split_among is null or jsonb_array_length(new.split_among) <> 1
       or (new.split_among ->> 0)::uuid = new.paid_by) then
    raise exception 'Acerto é de uma pessoa para outra' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
