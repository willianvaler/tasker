-- Kits por assunto (PB6, V3 §6 B, D301): o modelo pronto pode trazer etapas em ordem (dependências
-- entre as tarefas do próprio modelo) e uma página de gastos com orçamento. O create_from_template
-- passa a aceitar, em cada página, `budget_cents` (só na de gastos) e, no topo, `deps`
-- ([{task, on}], ids que o app gerou para os itens). Dependência para fora do projeto novo é ignorada.

create or replace function public.create_from_template(p_name text, p_icon text, p_data jsonb, p_shared boolean default true)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid := gen_random_uuid();
  v_page_id uuid;
  v_page jsonb;
  v_position integer := 0;
  v_view public.page_view_type;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data -> 'pages') <> 'array' or jsonb_array_length(p_data -> 'pages') = 0
     or jsonb_array_length(p_data -> 'pages') > 30 then
    raise exception 'Modelo inválido (de 1 a 30 páginas)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data -> 'deps') = 'array' and jsonb_array_length(p_data -> 'deps') > 300 then
    raise exception 'No máximo 300 dependências por modelo' using errcode = '22023';
  end if;

  insert into public.folders (id, owner_id, name, icon, is_shared, position)
  values (v_folder_id, auth.uid(), trim(p_name), nullif(trim(p_icon), ''), p_shared,
          (select coalesce(max(position), 0) + 1 from public.folders where owner_id = auth.uid() and parent_id is null));

  for v_page in select * from jsonb_array_elements(p_data -> 'pages') loop
    v_position := v_position + 1;
    v_view := coalesce(v_page ->> 'view_type', 'list')::public.page_view_type;
    insert into public.pages (folder_id, name, icon, view_type, reset_cycle, position, budget_cents)
    values (v_folder_id, trim(v_page ->> 'name'), nullif(trim(v_page ->> 'icon'), ''), v_view,
            coalesce(v_page ->> 'reset_cycle', 'none')::public.page_reset_cycle, v_position,
            case when v_view = 'expenses' and jsonb_typeof(v_page -> 'budget_cents') = 'number'
                 then (v_page ->> 'budget_cents')::bigint end)
    returning id into v_page_id;
    if v_view <> 'expenses' and jsonb_typeof(v_page -> 'items') = 'array'
       and jsonb_array_length(v_page -> 'items') > 0 then
      perform public.create_tasks_batch(v_page_id, v_page -> 'items');
    end if;
  end loop;

  -- Etapas em ordem: só entre tarefas que acabaram de nascer neste projeto
  if jsonb_typeof(p_data -> 'deps') = 'array' then
    insert into public.task_dependencies (task_id, depends_on_task_id)
    select distinct t.id, o.id
    from jsonb_array_elements(p_data -> 'deps') d
    join public.tasks t on t.id::text = d ->> 'task' and t.folder_id = v_folder_id
    join public.tasks o on o.id::text = d ->> 'on' and o.folder_id = v_folder_id
    where t.id <> o.id
    on conflict do nothing;
  end if;

  -- A atividade de "criou N tarefas" do modelo não interessa a ninguém
  delete from public.activity_log where folder_id = v_folder_id;
  return v_folder_id;
end;
$$;
