-- V3 §1.2 (G2): tarefa-mãe é pacote. Só as folhas geram XP; a mãe não se conclui com filha
-- pendente; concluir a última filha conclui a mãe (configurável por projeto, padrão ligado) e
-- reabrir uma filha reabre a mãe. "Concluir tudo" conclui as folhas abertas do galho.

alter table public.folders add column auto_complete_parent boolean not null default true;
grant update (auto_complete_parent) on public.folders to authenticated;

-- O prêmio de antes vira a conta das folhas; o nome antigo passa a filtrar
alter function public._award_completion(public.tasks, public.pages, uuid, text, boolean)
  rename to _award_leaf_completion;

create function public._award_completion(
  p_task public.tasks, p_page public.pages, p_completion_id uuid, p_cycle_kind text, p_created_done boolean
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  -- Tarefa com subtarefas é agrupadora: não dá XP, dano nem ouro (evita farm criando subtarefas)
  if exists (select 1 from public.tasks where parent_task_id = p_task.id) then
    return jsonb_build_object('xp', 0, 'damage', 0, 'crit', false, 'gold', 0, 'boss_defeated', false);
  end if;
  return public._award_leaf_completion(p_task, p_page, p_completion_id, p_cycle_kind, p_created_done);
end;
$$;

revoke execute on function public._award_completion(public.tasks, public.pages, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public._award_leaf_completion(public.tasks, public.pages, uuid, text, boolean) from public, anon, authenticated;

-- A mãe só fica concluída com todas as filhas concluídas
create function public.tasks_parent_needs_children()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'done' and old.status <> 'done'
     and exists (select 1 from public.tasks where parent_task_id = new.id and status <> 'done') then
    raise exception 'Conclua as subtarefas antes (ou use "Concluir tudo")' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger tasks_parent_needs_children
  before update of status on public.tasks
  for each row execute function public.tasks_parent_needs_children();

-- Filha concluída fecha a mãe (se o projeto quiser); filha reaberta reabre a mãe
create function public.tasks_parent_follow()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.tasks;
  v_auto boolean;
begin
  if new.parent_task_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  select * into v_parent from public.tasks where id = new.parent_task_id;
  if v_parent.id is null then
    return null;
  end if;

  if new.status = 'done' and v_parent.status <> 'done' then
    select r.auto_complete_parent into v_auto
    from public.folders f join public.folders r on r.id = coalesce(f.parent_id, f.id)
    where f.id = v_parent.folder_id;
    if coalesce(v_auto, true)
       and not exists (select 1 from public.tasks where parent_task_id = v_parent.id and status <> 'done') then
      -- Pelo complete_task: registra a conclusão e sobe para a avó se for o caso (sem XP: não é folha)
      perform public.complete_task(v_parent.id);
    end if;
  elsif old.status = 'done' and new.status <> 'done' and v_parent.status = 'done' then
    perform public.uncomplete_task(v_parent.id);
  end if;
  return null;
end;
$$;

create trigger tasks_parent_follow
  after update of status on public.tasks
  for each row execute function public.tasks_parent_follow();

-- "Concluir tudo": as folhas abertas do galho, da mais funda para cima. As mães se fecham sozinhas
-- (com o auto desligado, fecha as mães também). Devolve quantas tarefas foram concluídas.
create function public.complete_tree(p_task_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_id uuid;
  v_count integer := 0;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  for v_id in
    with recursive galho as (
      select id, depth from public.tasks where id = p_task_id
      union all
      select t.id, t.depth from public.tasks t join galho g on t.parent_task_id = g.id
    )
    select g.id from galho g join public.tasks t on t.id = g.id
    where t.status <> 'done'
    order by g.depth desc
  loop
    -- A mãe pode ter sido fechada pela última filha no meio do caminho
    if (select status from public.tasks where id = v_id) <> 'done' then
      perform public.complete_task(v_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.complete_tree(uuid) to authenticated;

-- "Concluir tudo" também pela fila do aparelho (offline)
create or replace function public.run_once(p_key uuid, p_name text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.applied_ops (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  -- Se a ação falhar, a exceção desfaz também a chave: o reenvio tenta de novo
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'complete_tree' then
      return jsonb_build_object('count', public.complete_tree((p_args ->> 'p_task_id')::uuid));
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;
