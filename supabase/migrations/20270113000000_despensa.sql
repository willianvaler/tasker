-- CS4 (ESCOPO_V15 §4, D390): despensa e compras. Uma lista do tipo 'pantry' guarda itens
-- (`pantry_items`: nome, quantidade, mínimo, unidade e quanto comprar de cada vez), não tarefas,
-- como os gastos (D218). Quem é da pasta vê; quem cria tarefas na pasta mexe (é coisa da casa).
-- Item que **acabou** (quantidade 0) ou ficou **abaixo do mínimo** ganha uma tarefa na lista de
-- compras da despensa (`pages.config.pantry.shopping`, uma lista da mesma pasta), uma só enquanto
-- estiver aberta; concluir essa tarefa (de qualquer lugar) soma ao estoque o que se compra de cada
-- vez, e desfazer tira. Tudo no servidor, para dois aparelhos sem conexão não criarem duas.

alter type public.page_view_type add value if not exists 'pantry';

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text not null default '' check (char_length(unit) <= 20),
  qty numeric not null default 0 check (qty between 0 and 1e6),
  min_qty numeric not null default 0 check (min_qty between 0 and 1e6),
  buy_qty numeric not null default 1 check (buy_qty > 0 and buy_qty <= 1e6),
  position double precision not null default 0,
  -- A tarefa de compra aberta (só o servidor escreve)
  shopping_task_id uuid references public.tasks (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pantry_items_page on public.pantry_items (page_id, position);
create index pantry_items_folder on public.pantry_items (folder_id);
create unique index pantry_items_task on public.pantry_items (shopping_task_id);

-- A pasta vem da página, que tem de ser uma despensa
create function public.pantry_items_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type text;
begin
  select p.folder_id, p.view_type::text into new.folder_id, v_type from public.pages p where p.id = new.page_id;
  if v_type is distinct from 'pantry' then
    raise exception 'A lista não é uma despensa' using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  new.unit := btrim(new.unit);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- Só o servidor mexe na ligação com a compra
    if current_setting('questlist.pantry', true) is distinct from '1' then
      new.shopping_task_id := old.shopping_task_id;
    end if;
  elsif current_setting('questlist.pantry', true) is distinct from '1' then
    new.shopping_task_id := null;
  end if;
  return new;
end;
$$;
create trigger pantry_items_fill before insert or update on public.pantry_items
  for each row execute function public.pantry_items_fill();

alter table public.pantry_items enable row level security;
revoke all on public.pantry_items from anon;
revoke insert, update on public.pantry_items from authenticated;
grant insert (id, page_id, name, unit, qty, min_qty, buy_qty, position),
      update (name, unit, qty, min_qty, buy_qty, position)
  on public.pantry_items to authenticated;
create policy "pantry_items_select" on public.pantry_items for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "pantry_items_insert" on public.pantry_items for insert to authenticated
  with check (public.has_permission(folder_id, 'task.create', false, true));
create policy "pantry_items_update" on public.pantry_items for update to authenticated
  using (public.has_permission(folder_id, 'task.create', false, true))
  with check (public.has_permission(folder_id, 'task.create', false, true));
create policy "pantry_items_delete" on public.pantry_items for delete to authenticated
  using (public.has_permission(folder_id, 'task.create', false, true));

-- Texto da compra: "Arroz (2 kg)", com o número como a pessoa escreveria
create function public.pantry_buy_title(p_name text, p_buy numeric, p_unit text)
returns text
language sql immutable set search_path = ''
as $$
  select left(p_name || ' (' || replace(trim(trailing '.' from trim(trailing '0' from
    case when p_buy = trunc(p_buy) then trunc(p_buy)::text || '.' else p_buy::text end)), '.', ',')
    || case when p_unit = '' then '' else ' ' || p_unit end || ')', 500);
$$;

-- Precisa comprar? Acabou (0) ou ficou abaixo do mínimo
create function public.pantry_needs(p_qty numeric, p_min numeric)
returns boolean
language sql immutable set search_path = ''
as $$ select p_qty <= 0 or p_qty < p_min $$;

-- Acerta a tarefa de compra de um item: cria se precisa e não há aberta; tira a aberta (que
-- ninguém tocou) se não precisa mais
create function public._pantry_sync(p_item public.pantry_items)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page uuid;
  v_shopping text;
  v_id uuid;
  v_user uuid := coalesce(auth.uid(), p_item.created_by);
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if p_item.shopping_task_id is not null then
    select * into v_task from public.tasks where id = p_item.shopping_task_id;
  end if;
  if not public.pantry_needs(p_item.qty, p_item.min_qty) then
    if v_task.id is not null and v_task.status <> 'done' then
      perform set_config('questlist.pantry', '1', true);
      update public.pantry_items set shopping_task_id = null where id = p_item.id;
      perform set_config('questlist.pantry', '', true);
      delete from public.tasks where id = v_task.id;
    end if;
    return;
  end if;
  if v_task.id is not null and v_task.status <> 'done' then
    -- Já está na lista: só acerta o texto (o nome ou o quanto comprar mudou)
    if v_task.title is distinct from public.pantry_buy_title(p_item.name, p_item.buy_qty, p_item.unit) then
      update public.tasks set title = public.pantry_buy_title(p_item.name, p_item.buy_qty, p_item.unit)
      where id = v_task.id;
    end if;
    return;
  end if;
  -- A lista de compras da despensa: uma lista comum da mesma pasta
  select config #>> '{pantry,shopping}' into v_shopping from public.pages where id = p_item.page_id;
  select p.id into v_page from public.pages p
  where p.id::text = v_shopping and p.folder_id = p_item.folder_id
    and p.view_type::text in ('list', 'cards', 'kanban');
  if v_page is null or v_user is null then
    return;
  end if;
  v_id := gen_random_uuid();
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  begin
    perform public.create_tasks_batch(v_page, jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'title', public.pantry_buy_title(p_item.name, p_item.buy_qty, p_item.unit),
      'labels', jsonb_build_array('compras'),
      'meta', jsonb_build_object('despensa', jsonb_build_object('item', p_item.id)))));
  exception when insufficient_privilege then
    -- Quem mexeu não cria tarefas na lista de compras (ex.: concluiu sem poder criar): a compra
    -- nasce na próxima mudança feita por quem pode
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    return;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('questlist.pantry', '1', true);
  update public.pantry_items set shopping_task_id = v_id where id = p_item.id;
  perform set_config('questlist.pantry', '', true);
end;
$$;

create function public.pantry_items_after()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- A troca só da ligação (feita aqui mesmo) não precisa de nada
  if tg_op = 'UPDATE' and new.qty = old.qty and new.min_qty = old.min_qty and new.buy_qty = old.buy_qty
     and new.name = old.name and new.unit = old.unit then
    return null;
  end if;
  perform public._pantry_sync(new);
  return null;
end;
$$;
create trigger pantry_items_after after insert or update on public.pantry_items
  for each row execute function public.pantry_items_after();

-- Apagar o item tira a compra aberta (a concluída fica)
create function public.pantry_items_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.shopping_task_id is not null then
    delete from public.tasks where id = old.shopping_task_id and status <> 'done';
  end if;
  return null;
end;
$$;
-- Depois do delete: antes, a chave estrangeira tentaria soltar a ligação do item que está saindo
create trigger pantry_items_delete after delete on public.pantry_items
  for each row execute function public.pantry_items_delete();

-- Comprado: soma ao estoque e solta a tarefa (se ainda faltar, nasce outra). Desfazer tira o que
-- tinha somado e volta a ligar, se o item não tiver outra compra aberta
create function public.pantry_task_done()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.pantry_items;
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    select * into v_item from public.pantry_items where shopping_task_id = new.id;
    if v_item.id is null then
      return null;
    end if;
    perform set_config('questlist.pantry', '1', true);
    update public.pantry_items set shopping_task_id = null where id = v_item.id;
    perform set_config('questlist.pantry', '', true);
    update public.pantry_items set qty = least(1e6, qty + buy_qty) where id = v_item.id;
  elsif old.status = 'done' and new.status <> 'done' and new.meta ? 'despensa' then
    select * into v_item from public.pantry_items
    where (new.meta #>> '{despensa,item}') = id::text;
    if v_item.id is null or v_item.shopping_task_id = new.id then
      return null;
    end if;
    -- A compra que nasceu depois (intocada) sai; esta volta a ser a aberta
    if v_item.shopping_task_id is not null then
      delete from public.tasks t where t.id = v_item.shopping_task_id and t.status = 'todo';
    end if;
    perform set_config('questlist.pantry', '1', true);
    update public.pantry_items set shopping_task_id = new.id where id = v_item.id;
    perform set_config('questlist.pantry', '', true);
    update public.pantry_items set qty = greatest(0, qty - buy_qty) where id = v_item.id;
  end if;
  return null;
end;
$$;
create trigger pantry_task_done after update of status on public.tasks
  for each row when (new.status is distinct from old.status and (new.status = 'done' or old.status = 'done'))
  execute function public.pantry_task_done();

revoke execute on function public.pantry_items_fill(), public._pantry_sync(public.pantry_items),
  public.pantry_items_after(), public.pantry_items_delete(), public.pantry_task_done()
  from public, anon, authenticated;

alter publication powersync add table public.pantry_items;
