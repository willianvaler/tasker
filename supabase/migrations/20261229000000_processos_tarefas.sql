-- Processos: tarefas humanas (ESCOPO_V16 PR6, D353). A tarefa é uma tarefa normal do Questlist
-- (aparece na Hoje, nos filtros e no "eu levo"), ligada à instância e ao nó por `meta.processo`.
-- - Formulário e escolhas ("Aprovar/Rejeitar"): respondidos por `process_complete_task`, validados
--   no servidor; com formulário obrigatório ou escolhas, a caixinha sozinha não conclui.
-- - Delegar (para quem pode mexer na tarefa) e devolver ao grupo, com o histórico.
-- - Quem sai do projeto: a tarefa volta ao grupo ou à dona da definição (`opcoes.reatribuir`).
-- - XP: não rende, a não ser que a definição ligue (`xp`); ligado, rende uma vez, como qualquer tarefa.

-- XP: a tarefa de processo não rende por padrão (V16-13)
create or replace function public._award_completion(p_task public.tasks, p_page public.pages, p_completion_id uuid,
                                                    p_cycle_kind text, p_created_done boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  -- Tarefa com subtarefas é agrupadora: não dá XP, dano nem ouro (evita farm criando subtarefas)
  -- Tarefa de processo também não, a não ser que a definição ligue (PR6, D353)
  if exists (select 1 from public.tasks where parent_task_id = p_task.id)
     or (p_task.meta ? 'processo' and (p_task.meta #>> '{processo,xp}')::boolean is not true) then
    return jsonb_build_object('xp', 0, 'damage', 0, 'crit', false, 'gold', 0, 'boss_defeated', false);
  end if;
  return public._award_leaf_completion(p_task, p_page, p_completion_id, p_cycle_kind, p_created_done);
end;
$$;

-- A espera aberta da tarefa (ou nada)
create function public._process_wait_of_task(p_task uuid)
returns public.process_waits
language sql stable security definer set search_path = ''
as $$
  select w.* from public.process_waits w where w.task_id = p_task and w.resolved_at is null and w.kind = 'humana' limit 1;
$$;

-- Com formulário obrigatório ou escolhas, concluir pede a resposta (pela RPC)
create function public.process_task_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits;
begin
  if new.status <> 'done' or old.status = 'done' or not (new.meta ? 'processo') then
    return new;
  end if;
  v_wait := public._process_wait_of_task(new.id);
  if v_wait.id is null or v_wait.data ? 'resposta' then
    return new;
  end if;
  if jsonb_array_length(coalesce(v_wait.data -> 'escolhas', '[]')) > 0
     or exists (select 1 from jsonb_array_elements(coalesce(v_wait.data -> 'formulario', '[]')) c
                where (c ->> 'obrigatorio')::boolean is true) then
    raise exception 'Esta tarefa do processo pede uma resposta: abra a tarefa e responda' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger process_task_guard before update of status on public.tasks
  for each row execute function public.process_task_guard();

-- Responder e concluir: valida o formulário e a escolha no servidor
create function public.process_complete_task(p_task uuid, p_escolha text default null, p_formulario jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits := public._process_wait_of_task(p_task);
  v_campo jsonb;
  v_valor jsonb;
  v_resp jsonb := '{}';
begin
  if v_wait.id is null then
    raise exception 'Esta tarefa não espera resposta de processo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tasks t where t.id = p_task
                 and (t.created_by = auth.uid() or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = auth.uid())
                      or public.has_permission(t.folder_id, 'task.complete', false, false))) then
    raise exception 'Sem permissão para concluir esta tarefa' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(v_wait.data -> 'escolhas', '[]')) > 0
     and not (v_wait.data -> 'escolhas') ? coalesce(p_escolha, '') then
    raise exception 'Escolha uma das opções' using errcode = '22023';
  end if;
  for v_campo in select value from jsonb_array_elements(coalesce(v_wait.data -> 'formulario', '[]')) loop
    v_valor := coalesce(p_formulario, '{}') -> (v_campo ->> 'nome');
    if (v_campo ->> 'obrigatorio')::boolean is true
       and (v_valor is null or v_valor = 'null'::jsonb or v_valor = '""'::jsonb) then
      raise exception 'Campo obrigatório: %', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
    end if;
    if v_valor is not null and v_valor <> 'null'::jsonb then
      case coalesce(v_campo ->> 'tipo', 'texto')
        when 'numero' then
          if jsonb_typeof(v_valor) <> 'number' then
            raise exception 'Campo % precisa ser um número', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
          end if;
        when 'data' then
          if v_valor #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then
            raise exception 'Campo % precisa ser uma data', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
          end if;
        when 'caixa' then
          if jsonb_typeof(v_valor) <> 'boolean' then
            raise exception 'Campo % é sim ou não', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
          end if;
        when 'selecao' then
          if not coalesce(v_campo -> 'opcoes', '[]') ? (v_valor #>> '{}') then
            raise exception 'Campo %: escolha uma das opções', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
          end if;
        else
          if char_length(v_valor #>> '{}') > 2000 then
            raise exception 'Campo % com mais de 2.000 caracteres', coalesce(v_campo ->> 'rotulo', v_campo ->> 'nome') using errcode = '22023';
          end if;
      end case;
      v_resp := v_resp || jsonb_build_object(v_campo ->> 'nome', v_valor);
    end if;
  end loop;
  update public.process_waits set data = data || jsonb_build_object('resposta',
    jsonb_strip_nulls(jsonb_build_object('escolha', p_escolha, 'formulario', v_resp)))
  where id = v_wait.id;
  return public.complete_task(p_task);
end;
$$;

-- Delegar: para alguém que pode mexer na tarefa (é do projeto); fica no histórico
create function public.process_delegate(p_task uuid, p_pessoa uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits := public._process_wait_of_task(p_task);
  v_task public.tasks;
  v_inst public.process_instances;
begin
  select * into v_task from public.tasks where id = p_task;
  if v_wait.id is null or v_task.id is null then
    raise exception 'Esta tarefa não é de processo' using errcode = '22023';
  end if;
  select * into v_inst from public.process_instances where id = v_wait.instance_id;
  if not (v_inst.owner_id = auth.uid() or exists (select 1 from public.task_assignees where task_id = p_task and user_id = auth.uid())) then
    raise exception 'Só quem recebeu a tarefa (ou a dona do processo) delega' using errcode = '42501';
  end if;
  if not exists (select 1 from public.folder_members m where m.folder_id = public.folder_root(v_task.folder_id) and m.user_id = p_pessoa)
     and p_pessoa <> v_inst.owner_id then
    raise exception 'A pessoa precisa ser do projeto da tarefa' using errcode = '22023';
  end if;
  delete from public.task_assignees where task_id = p_task;
  insert into public.task_assignees (task_id, user_id) values (p_task, p_pessoa) on conflict do nothing;
  update public.process_waits set data = data || jsonb_build_object('pessoa', p_pessoa) where id = v_wait.id;
  insert into public.process_steps (instance_id, token_id, node_id, node_type, status, assignee, result, finished_at)
  values (v_inst.id, v_wait.token_id, (select node_id from public.process_tokens where id = v_wait.token_id), 'humana',
          'esperando', p_pessoa, jsonb_build_object('delegou', auth.uid(), 'para', p_pessoa, 'tarefa', p_task), now());
end;
$$;

-- Devolver ao grupo: a tarefa fica sem ninguém (alguém do grupo assume pelo "eu levo")
create function public.process_return_task(p_task uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits := public._process_wait_of_task(p_task);
begin
  if v_wait.id is null then
    raise exception 'Esta tarefa não é de processo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.task_assignees where task_id = p_task and user_id = auth.uid())
     and not exists (select 1 from public.process_instances where id = v_wait.instance_id and owner_id = auth.uid()) then
    raise exception 'Só quem recebeu a tarefa devolve' using errcode = '42501';
  end if;
  delete from public.task_assignees where task_id = p_task;
  update public.process_waits set data = data - 'pessoa' where id = v_wait.id;
  insert into public.process_steps (instance_id, token_id, node_id, node_type, status, result, finished_at)
  values (v_wait.instance_id, v_wait.token_id, (select node_id from public.process_tokens where id = v_wait.token_id), 'humana',
          'esperando', jsonb_build_object('devolveu', auth.uid(), 'tarefa', p_task), now());
end;
$$;

-- Quem sai do projeto: a tarefa de processo dela volta ao grupo ou à dona (V16-8)
create function public.process_member_removed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  for v in
    select w.id as wait_id, w.task_id, w.token_id, w.instance_id, i.owner_id, ver.graph
    from public.process_waits w
    join public.process_instances i on i.id = w.instance_id
    join public.process_versions ver on ver.id = i.version_id
    join public.task_assignees a on a.task_id = w.task_id and a.user_id = old.user_id
    join public.tasks t on t.id = w.task_id
    where w.resolved_at is null and w.kind = 'humana' and public.folder_root(t.folder_id) = old.folder_id
  loop
    delete from public.task_assignees where task_id = v.task_id and user_id = old.user_id;
    if coalesce(v.graph #>> '{opcoes,reatribuir}', 'grupo') = 'dona' then
      insert into public.task_assignees (task_id, user_id) values (v.task_id, v.owner_id) on conflict do nothing;
    end if;
    insert into public.process_steps (instance_id, token_id, node_id, node_type, status, assignee, result, finished_at)
    values (v.instance_id, v.token_id, (select node_id from public.process_tokens where id = v.token_id), 'humana', 'esperando',
            case when coalesce(v.graph #>> '{opcoes,reatribuir}', 'grupo') = 'dona' then v.owner_id end,
            jsonb_build_object('saiu_do_projeto', old.user_id, 'tarefa', v.task_id,
                               'para', coalesce(v.graph #>> '{opcoes,reatribuir}', 'grupo')), now());
  end loop;
  return null;
end;
$$;
create trigger process_member_removed after delete on public.folder_members
  for each row execute function public.process_member_removed();

revoke execute on function public._process_wait_of_task(uuid), public.process_task_guard(), public.process_member_removed()
  from public, anon, authenticated;
revoke execute on function public.process_complete_task(uuid, text, jsonb), public.process_delegate(uuid, uuid),
  public.process_return_task(uuid) from public, anon;
grant execute on function public.process_complete_task(uuid, text, jsonb), public.process_delegate(uuid, uuid),
  public.process_return_task(uuid) to authenticated;
