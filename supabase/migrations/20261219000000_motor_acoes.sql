-- Motor de automações: as demais ações (ESCOPO_V14 §5, AU4, D336).
--
-- Cada ação é um efeito que o executor manda junto com o passo (automation_step) e que o banco
-- aplica como a dona da regra (auth.uid() é ela; D333): as checagens de sempre valem
-- (has_permission, is_folder_member, os guardas das tarefas e o create_tasks_batch, D16).
--   criar_tarefa      → create_tasks_batch na lista do passo (ou a do evento); evitar_duplicar não cria
--                        se já há tarefa aberta com o mesmo título na lista. Continua dando XP ao
--                        ser concluída, como qualquer outra (D333).
--   atualizar_tarefa  → só etiquetas, mover de lista e vencimento. Nada de concluir, reabrir ou
--                        apagar (V14-5): o efeito ignora qualquer outra chave.
--   atribuir          → só em regra de projeto, para alguém do projeto (task.assign).
--   descanso          → start_timer para quem fez a ação (na regra pessoal, a dona).
--   executar_regra    → evento `manual` para a outra regra, com a cadeia de quem chamou: ciclo e
--                        profundidade acima de 3 são recusados também na execução (§6.4).
--   alternar_modo_jogo → a preferência da dona (gamification_enabled/game_mode), nunca recompensa.
-- O que o efeito devolve (a tarefa criada, por exemplo) vai para o histórico do passo.

drop function public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text);
drop function public._automation_effect(public.automation_runs, public.automation_rules, jsonb);

-- Tarefa do passo: `tarefa` (id) ou a do evento
create function public._automation_task_of(p_run public.automation_runs, p_effect jsonb)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case
    when p_effect ->> 'tarefa' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'tarefa')::uuid
    when p_run.state #>> '{evento,tarefa}' ~ '^[0-9a-f-]{36}$' then (p_run.state #>> '{evento,tarefa}')::uuid
  end;
$$;

create function public._automation_effect(p_run public.automation_runs, p_rule public.automation_rules, p_effect jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task uuid;
  v_title text;
  v_target uuid;
  v_payload jsonb;
  v_page public.pages;
  v_row public.tasks;
  v_id uuid;
  v_labels text[];
  v_add text[];
  v_del text[];
  v_target_rule public.automation_rules;
  v_chain jsonb;
  v_actor uuid;
  v_claims text;
begin
  if p_rule.scope = 'projeto' and not public.is_folder_member(p_rule.folder_id) then
    raise exception 'Quem criou a automação não está mais no projeto';
  end if;

  case p_effect ->> 'tipo'
    when 'notificacao' then
      v_task := public._automation_task_of(p_run, '{}');
      v_title := (select title from public.tasks where id = v_task);
      v_payload := jsonb_strip_nulls(jsonb_build_object(
        'rule_id', p_rule.id, 'rule_name', p_rule.name,
        'titulo', nullif(p_effect ->> 'titulo', ''), 'message', nullif(p_effect ->> 'corpo', ''),
        'task_id', v_task, 'title', v_title,
        'push', case when p_effect ->> 'canal' = 'app' then false end));
      for v_target in
        select p_rule.owner_id where p_rule.scope = 'pessoal' or coalesce(p_effect ->> 'para', 'dona') = 'dona'
        union
        select a.user_id from public.task_assignees a
        where p_rule.scope = 'projeto' and p_effect ->> 'para' = 'responsaveis' and a.task_id = v_task
          and a.user_id is not null
        union
        select m.user_id from public.folder_members m
        where p_rule.scope = 'projeto' and p_effect ->> 'para' = 'pessoa' and m.folder_id = p_rule.folder_id
          and m.user_id::text = p_effect ->> 'pessoa'
      loop
        insert into public.notifications (user_id, kind, payload, read_at)
        values (v_target, 'automation', v_payload,
                case when p_effect ->> 'canal' = 'push' then now() end);
      end loop;
      return null;

    when 'criar_tarefa' then
      select * into v_page from public.pages
      where id = case when p_effect ->> 'lista' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'lista')::uuid
                      when p_run.state #>> '{evento,lista}' ~ '^[0-9a-f-]{36}$' then (p_run.state #>> '{evento,lista}')::uuid end;
      if v_page.id is null then
        raise exception 'Escolha a lista onde criar a tarefa';
      end if;
      if p_rule.scope = 'projeto' and public.folder_root(v_page.folder_id) <> p_rule.folder_id then
        raise exception 'A lista precisa ser deste projeto';
      end if;
      v_title := left(btrim(coalesce(p_effect ->> 'titulo', '')), 500);
      if v_title = '' then
        raise exception 'A tarefa precisa de título';
      end if;
      if (p_effect ->> 'evitar_duplicar')::boolean is true then
        select id into v_id from public.tasks
        where page_id = v_page.id and status <> 'done' and lower(title) = lower(v_title) limit 1;
        if v_id is not null then
          return jsonb_build_object('tarefa', v_id, 'duplicada', true);
        end if;
      end if;
      v_id := gen_random_uuid();
      perform public.create_tasks_batch(v_page.id, jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id', v_id, 'title', v_title,
        'due_date', case when p_effect ->> 'vencimento' ~ '^\d{4}-\d{2}-\d{2}$' then p_effect ->> 'vencimento' end,
        'labels', case when jsonb_typeof(p_effect -> 'etiquetas') = 'array' then p_effect -> 'etiquetas' end))));
      return jsonb_build_object('tarefa', v_id);

    when 'atualizar_tarefa' then
      -- V14-5: só estas chaves; concluir, reabrir e apagar não existem aqui
      v_task := public._automation_task_of(p_run, p_effect);
      select * into v_row from public.tasks where id = v_task;
      if v_row.id is null then
        raise exception 'A tarefa não existe mais';
      end if;
      if not public.has_permission(v_row.folder_id, 'task.edit',
           exists (select 1 from public.task_assignees where task_id = v_row.id and user_id = auth.uid()),
           v_row.created_by = auth.uid()) then
        raise exception 'Sem permissão para mudar esta tarefa';
      end if;
      v_add := array(select lower(regexp_replace(x, '^#', '')) from jsonb_array_elements_text(
        case when jsonb_typeof(p_effect -> 'adicionar_etiquetas') = 'array' then p_effect -> 'adicionar_etiquetas' else '[]' end) x
        where btrim(x) <> '');
      v_del := array(select lower(regexp_replace(x, '^#', '')) from jsonb_array_elements_text(
        case when jsonb_typeof(p_effect -> 'remover_etiquetas') = 'array' then p_effect -> 'remover_etiquetas' else '[]' end) x);
      v_labels := array(select distinct l from unnest(coalesce(v_row.labels, '{}') || v_add) l where not l = any (v_del));
      if v_labels is distinct from v_row.labels and (cardinality(v_add) > 0 or cardinality(v_del) > 0) then
        update public.tasks set labels = v_labels where id = v_row.id;
      end if;
      if p_effect ->> 'mover_para' ~ '^[0-9a-f-]{36}$' and v_row.parent_task_id is null
         and (p_effect ->> 'mover_para')::uuid <> v_row.page_id then
        select * into v_page from public.pages where id = (p_effect ->> 'mover_para')::uuid;
        if v_page.id is null or public.folder_root(v_page.folder_id) <> public.folder_root(v_row.folder_id) then
          raise exception 'A lista de destino precisa ser do mesmo projeto';
        end if;
        update public.tasks set page_id = v_page.id where id = v_row.id;
      end if;
      if p_effect ? 'vencimento' then
        if p_effect ->> 'vencimento' ~ '^\d{4}-\d{2}-\d{2}$' then
          update public.tasks set due_date = (p_effect ->> 'vencimento')::date where id = v_row.id;
        elsif p_effect -> 'vencimento' = 'null'::jsonb then
          update public.tasks set due_date = null, due_time = null where id = v_row.id;
        end if;
      end if;
      return jsonb_build_object('tarefa', v_row.id);

    when 'atribuir' then
      if p_rule.scope <> 'projeto' then
        raise exception 'Atribuir é só em automação de projeto';
      end if;
      v_task := public._automation_task_of(p_run, p_effect);
      select * into v_row from public.tasks where id = v_task;
      if v_row.id is null or public.folder_root(v_row.folder_id) <> p_rule.folder_id then
        raise exception 'A tarefa não é deste projeto';
      end if;
      if not public.has_permission(v_row.folder_id, 'task.assign') then
        raise exception 'Sem permissão para atribuir';
      end if;
      select m.user_id into v_target from public.folder_members m
      where m.folder_id = p_rule.folder_id and m.user_id::text = p_effect ->> 'pessoa';
      if v_target is null then
        raise exception 'A pessoa não é do projeto';
      end if;
      insert into public.task_assignees (task_id, user_id) values (v_row.id, v_target) on conflict do nothing;
      return jsonb_build_object('tarefa', v_row.id, 'pessoa', v_target);

    when 'descanso' then
      -- O descanso é de quem fez a ação (concluiu a série); sem ela, da dona
      v_actor := case when p_rule.scope = 'projeto' and p_run.state #>> '{evento,por}' ~ '^[0-9a-f-]{36}$'
                      then (p_run.state #>> '{evento,por}')::uuid else p_rule.owner_id end;
      v_task := public._automation_task_of(p_run, '{}');
      v_claims := current_setting('request.jwt.claims', true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
      perform public.start_timer(gen_random_uuid(), 'rest', now(),
        least(greatest(coalesce((p_effect ->> 'segundos')::integer, 60), 5), 3600), v_task,
        jsonb_strip_nulls(jsonb_build_object('label', (select title from public.tasks where id = v_task), 'after', true)), null);
      perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
      return jsonb_build_object('para', v_actor);

    when 'executar_regra' then
      select * into v_target_rule from public.automation_rules
      where id = case when p_effect ->> 'regra' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'regra')::uuid end;
      -- Pessoal chama pessoal da mesma dona; projeto chama do mesmo projeto (o mesmo do automation_validate)
      if v_target_rule.id is null or v_target_rule.scope <> p_rule.scope
         or (p_rule.scope = 'pessoal' and v_target_rule.owner_id <> p_rule.owner_id)
         or (p_rule.scope = 'projeto' and v_target_rule.folder_id <> p_rule.folder_id) then
        raise exception 'A automação chamada não existe ou não é da mesma dona';
      end if;
      if not v_target_rule.enabled then
        raise exception 'A automação chamada está desligada';
      end if;
      v_chain := coalesce(p_run.state #> '{evento,_cadeia}', '[]') || to_jsonb(p_rule.id::text);
      if v_chain ? v_target_rule.id::text then
        raise exception 'Automação chamando a si mesma em círculo';
      end if;
      if jsonb_array_length(v_chain) >= 3 then
        raise exception 'No máximo 3 automações em sequência';
      end if;
      insert into public.automation_events (owner_id, folder_id, kind, payload)
      values (v_target_rule.owner_id, v_target_rule.folder_id, 'manual',
              coalesce(p_run.state -> 'evento', '{}') || jsonb_build_object('regra', v_target_rule.id, '_cadeia', v_chain))
      returning id into v_id;
      return jsonb_build_object('evento', v_id);

    when 'alternar_modo_jogo' then
      if p_rule.scope <> 'pessoal' then
        raise exception 'O modo jogo é preferência de cada pessoa';
      end if;
      if p_effect ->> 'modo' not in ('off', 'light', 'full') then
        raise exception 'Modo de jogo: off, light ou full';
      end if;
      update public.profiles
      set gamification_enabled = p_effect ->> 'modo' <> 'off',
          game_mode = case when p_effect ->> 'modo' = 'off' then game_mode else p_effect ->> 'modo' end
      where id = p_rule.owner_id;
      return jsonb_build_object('modo', p_effect ->> 'modo');

    else
      raise exception 'Efeito desconhecido: %', p_effect ->> 'tipo';
  end case;
end;
$$;

create function public.automation_step(
  p_run uuid, p_claim timestamptz, p_step integer, p_next integer, p_state jsonb,
  p_effect jsonb default null, p_log jsonb default null, p_warnings jsonb default '[]',
  p_status text default 'rodando', p_error text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.automation_runs;
  v_rule public.automation_rules;
  v_status text := p_status;
  v_error text := p_error;
  v_log jsonb := p_log;
  v_result jsonb;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if p_status not in ('rodando', 'ok', 'falhou') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  select * into v_run from public.automation_runs where id = p_run for update;
  if v_run.id is null or v_run.status <> 'rodando' or v_run.step <> p_step
     or v_run.claimed_at is distinct from p_claim then
    return 'ignorado';
  end if;
  select * into v_rule from public.automation_rules where id = v_run.rule_id;

  if p_effect is not null and v_status <> 'falhou' then
    -- Roda como a dona (D333): permissões e guardas veem ela
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', v_rule.owner_id, 'role', 'authenticated')::text, true);
    begin
      v_result := public._automation_effect(v_run, v_rule, p_effect);
      if v_result is not null then
        v_log := coalesce(v_log, '{}') || jsonb_build_object('resultado', v_result);
      end if;
    exception when others then
      v_status := 'falhou';
      v_error := left(sqlerrm, 300);
      v_log := coalesce(p_log, '{}') || jsonb_build_object('ok', false, 'erro', v_error);
    end;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  end if;

  update public.automation_runs set
    step = case when v_status = 'falhou' then p_step else p_next end,
    state = case when v_status = 'falhou' then state else coalesce(p_state, state) end,
    steps = case when v_log is null then steps else steps || jsonb_build_array(v_log) end,
    warnings = warnings || coalesce(p_warnings, '[]'),
    status = v_status,
    error = v_error,
    finished_at = case when v_status in ('ok', 'falhou') then now() end
  where id = p_run;

  if v_status = 'ok' then
    update public.automation_rules
    set runs = runs + 1, last_run_at = now(), consecutive_failures = 0
    where id = v_rule.id;
  elsif v_status = 'falhou' then
    update public.automation_rules
    set consecutive_failures = consecutive_failures + 1, last_run_at = now()
    where id = v_rule.id;
  end if;
  return case when v_status = 'falhou' and p_status <> 'falhou' then 'falhou' else 'ok' end;
end;
$$;

revoke execute on function public._automation_task_of(public.automation_runs, jsonb),
  public._automation_effect(public.automation_runs, public.automation_rules, jsonb),
  public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.automation_step(uuid, timestamptz, integer, integer, jsonb, jsonb, jsonb, jsonb, text, text)
  to service_role;
