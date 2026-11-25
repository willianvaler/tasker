-- Processos e anotações (ESCOPO_V16 PR7, D357). As anotações ganham gatilhos no catálogo do V14
-- (criada, propriedade mudou, etiqueta adicionada e marcada como, que é o botão do ED4), que valem
-- para automações e para iniciar processos, e ações que só acrescentam ou definem (acrescentar
-- texto no fim, definir propriedade, pôr etiqueta, criar de um modelo) e iniciar processo. Só as
-- propriedades guardadas disparam (as calculadas não existem no banco, D318). A ação de um
-- processo que muda a página de onde ele veio não reinicia o mesmo processo.

-- O catálogo ganha os gatilhos e as ações de página
create or replace function public.automation_catalog()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $$
  select jsonb_build_object(
    'gatilhos', jsonb_build_object(
      'tarefa.criada',    jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'tarefa.concluida', jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'tarefa.atrasada',  jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'tarefa.vencendo',  jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'tarefa.pronta',    jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'tarefa.atribuida', jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'lista.concluida',  jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'marco.atingido',   jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'nivel.subiu',      jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'boss.derrotado',   jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'horario',          jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'intervalo',        jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'webhook',          jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'manual',           jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto')),
      'pagina.criada',            jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'pagina.propriedade_mudou', jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'pagina.tag_adicionada',    jsonb_build_object('escopos', jsonb_build_array('pessoal')),
      'pagina.marcada_como',      jsonb_build_object('escopos', jsonb_build_array('pessoal'))),
    'passos', jsonb_build_object(
      'notificar',            jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'criar_tarefa',         jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'atualizar_tarefa',     jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'atribuir',             jsonb_build_object('escopos', jsonb_build_array('projeto'), 'externo', false),
      'descanso',             jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'enviar_webhook',       jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', true),
      'comandar_dispositivo', jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', true),
      'esperar',              jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'executar_regra',       jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'definir_variavel',     jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'se',                   jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'parar',                jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'), 'externo', false),
      'alternar_modo_jogo',   jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false),
      'pagina.criar_de_modelo',    jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false),
      'pagina.anexar_texto',       jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false),
      'pagina.definir_propriedade', jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false),
      'pagina.adicionar_tag',      jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false),
      'iniciar_processo',          jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false)),
    'operadores', jsonb_build_array('=', '≠', '<', '≤', '>', '≥', 'contem', 'comeca_com', 'em', 'vazio'),
    'prontas', jsonb_build_array('janela_horario', 'dias_semana', 'projeto', 'lista', 'etiqueta', 'nivel_min'));
$$;

-- Validação das ações novas
create or replace function public._automation_check_steps(p_steps jsonb, p_scope text, p_level integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $$
declare
  v_step jsonb;
  v_type text;
  v_count integer := 0;
  v_catalog jsonb := public.automation_catalog() -> 'passos';
  v_key text;
begin
  if jsonb_typeof(p_steps) <> 'array' then
    perform public._automation_fail('Os passos precisam ser uma lista');
  end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_type := v_step ->> 'tipo';
    if jsonb_typeof(v_step) <> 'object' or v_type is null or not v_catalog ? v_type then
      perform public._automation_fail('Passo desconhecido: ' || coalesce(v_type, '?'));
    end if;
    if not (v_catalog -> v_type -> 'escopos') ? p_scope then
      perform public._automation_fail('O passo ' || v_type || ' não vale para regra de ' || p_scope);
    end if;
    v_count := v_count + 1;
    case v_type
      when 'se' then
        if p_level >= 3 then
          perform public._automation_fail('SE dentro de SE com no máximo 3 níveis');
        end if;
        if not v_step ? 'condicao' then
          perform public._automation_fail('SE precisa de condição');
        end if;
        perform public._automation_check_condition(v_step -> 'condicao', 0);
        v_count := v_count + public._automation_check_steps(coalesce(v_step -> 'entao', '[]'), p_scope, p_level + 1)
                           + public._automation_check_steps(coalesce(v_step -> 'senao', '[]'), p_scope, p_level + 1);
      when 'notificar' then
        if char_length(coalesce(v_step ->> 'titulo', '')) > 80 or char_length(coalesce(v_step ->> 'corpo', '')) > 240 then
          perform public._automation_fail('Aviso: título até 80 e texto até 240 caracteres');
        end if;
        if coalesce(v_step ->> 'canal', 'ambos') not in ('app', 'push', 'ambos') then
          perform public._automation_fail('Canal do aviso: app, push ou ambos');
        end if;
      when 'criar_tarefa' then
        if char_length(btrim(coalesce(v_step ->> 'titulo', ''))) = 0 or char_length(v_step ->> 'titulo') > 500 then
          perform public._automation_fail('Criar tarefa precisa de título (até 500 caracteres)');
        end if;
      when 'atualizar_tarefa' then
        -- V14-5: nada de concluir, reabrir ou apagar
        for v_key in select jsonb_object_keys(v_step) loop
          if v_key not in ('tipo', 'tarefa', 'adicionar_etiquetas', 'remover_etiquetas', 'mover_para', 'vencimento') then
            perform public._automation_fail('Atualizar tarefa não aceita: ' || v_key);
          end if;
        end loop;
      when 'esperar' then
        if coalesce((v_step ->> 'minutos')::numeric, 0) not between 1 and 10080 then
          perform public._automation_fail('Esperar de 1 minuto a 7 dias');
        end if;
      when 'definir_variavel' then
        if coalesce(v_step ->> 'nome', '') !~ '^[a-z_][a-z0-9_]{0,30}$' then
          perform public._automation_fail('Nome de variável: letras minúsculas, números e _');
        end if;
      when 'executar_regra' then
        if coalesce(v_step ->> 'regra', '') !~ '^[0-9a-f-]{36}$' then
          perform public._automation_fail('Executar regra precisa da regra');
        end if;
      when 'enviar_webhook' then
        if coalesce(v_step ->> 'url', '') !~* '^https://' or char_length(v_step ->> 'url') > 2000 then
          perform public._automation_fail('Webhook: só endereços https://');
        end if;
        if upper(coalesce(v_step ->> 'metodo', 'POST')) not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE') then
          perform public._automation_fail('Webhook: método GET, POST, PUT, PATCH ou DELETE');
        end if;
        if v_step ? 'cabecalhos' then
          if jsonb_typeof(v_step -> 'cabecalhos') <> 'object'
             or (select count(*) from jsonb_object_keys(v_step -> 'cabecalhos')) > 20 then
            perform public._automation_fail('Webhook: até 20 cabeçalhos');
          end if;
          for v_key in select jsonb_object_keys(v_step -> 'cabecalhos') loop
            if v_key ~* '^(host|content-length|connection|transfer-encoding|x-questlist-.*)$' or v_key !~ '^[A-Za-z0-9-]{1,64}$' then
              perform public._automation_fail('Webhook: cabeçalho não permitido: ' || v_key);
            end if;
            if not (jsonb_typeof(v_step -> 'cabecalhos' -> v_key) = 'string'
                    or (jsonb_typeof(v_step -> 'cabecalhos' -> v_key) = 'object'
                        and coalesce(v_step -> 'cabecalhos' -> v_key ->> 'segredo', '') ~ '^[a-z][a-z0-9_]{0,30}$')) then
              perform public._automation_fail('Webhook: o cabeçalho é um texto ou um segredo');
            end if;
          end loop;
        end if;
        if v_step ? 'corpo' and jsonb_typeof(v_step -> 'corpo') not in ('object', 'array', 'null') then
          perform public._automation_fail('Webhook: o corpo é um objeto JSON');
        end if;
      when 'pagina.anexar_texto' then
        if char_length(coalesce(v_step ->> 'texto', '')) not between 1 and 10240 then
          perform public._automation_fail('Acrescentar texto: de 1 a 10 mil caracteres');
        end if;
      when 'pagina.definir_propriedade' then
        if coalesce(v_step ->> 'propriedade', '') !~ '^[^\s][^\n]{0,59}$' then
          perform public._automation_fail('Definir propriedade: diga qual');
        end if;
      when 'pagina.adicionar_tag' then
        if char_length(btrim(coalesce(v_step ->> 'tag', ''))) not between 1 and 50 then
          perform public._automation_fail('Pôr etiqueta: de 1 a 50 caracteres');
        end if;
      when 'pagina.criar_de_modelo' then
        if coalesce(v_step ->> 'modelo', '') !~ '^[0-9a-f-]{36}$' then
          perform public._automation_fail('Criar de modelo: escolha o modelo');
        end if;
      when 'iniciar_processo' then
        if coalesce(v_step ->> 'processo', '') !~ '^[0-9a-f-]{36}$' then
          perform public._automation_fail('Iniciar processo: escolha o processo');
        end if;
      when 'alternar_modo_jogo' then
        if coalesce(v_step ->> 'modo', '') not in ('off', 'light', 'full') then
          perform public._automation_fail('Modo de jogo: off, light ou full');
        end if;
      else
        null;
    end case;
  end loop;
  return v_count;
end;
$$;

-- Efeitos das ações novas
create or replace function public._automation_effect(p_run automation_runs, p_rule automation_rules, p_effect jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
      -- Regra antiga (D143): o aviso sai no formato de antes (mensagem: "tarefa"), sem o rule_id
      v_payload := jsonb_strip_nulls(jsonb_build_object(
        'rule_id', case when p_rule.trigger is null then p_rule.id end, 'automation_rule', p_rule.id,
        'rule_name', p_rule.name,
        'titulo', nullif(p_effect ->> 'titulo', ''), 'message', nullif(p_effect ->> 'corpo', ''),
        'task_id', v_task, 'title', v_title,
        'push', case when p_effect ->> 'canal' = 'app' then false end));
      -- Até 10 avisos por hora por regra e pessoa (V14 §5); passando disso, a execução fica `limitada`
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
        if (select count(*) from public.notifications n
            where n.user_id = v_target and n.kind = 'automation' and n.created_at > now() - interval '1 hour'
              and n.payload ->> 'automation_rule' = p_rule.id::text) >= public._automation_limit('automation_limit_notify_hour', 10) then
          raise exception 'Limite de avisos por hora desta automação' using errcode = 'QL429';
        end if;
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

    -- Ações sobre anotações (PR7, D357): só acrescentam ou definem; nunca substituem o texto (V16-14)
    when 'pagina.anexar_texto', 'pagina.definir_propriedade', 'pagina.adicionar_tag' then
      v_id := case when p_effect ->> 'pagina' ~ '^[0-9a-f-]{36}$' then (p_effect ->> 'pagina')::uuid
                   when p_run.state #>> '{evento,pagina}' ~ '^[0-9a-f-]{36}$' then (p_run.state #>> '{evento,pagina}')::uuid end;
      if v_id is null or not public.can_edit_note(v_id) then
        raise exception 'Anotação não encontrada ou sem permissão para mudar';
      end if;
      if p_effect ->> 'tipo' = 'pagina.anexar_texto' then
        update public.notes set body = left(body || case when body = '' then '' else E'\n\n' end
                                            || left(p_effect ->> 'texto', 10240), 1000000)
        where id = v_id;
      elsif p_effect ->> 'tipo' = 'pagina.definir_propriedade' then
        update public.notes set props = coalesce(props, '{}') || jsonb_build_object(p_effect ->> 'propriedade', p_effect -> 'valor')
        where id = v_id;
      else
        update public.notes set props = jsonb_set(coalesce(props, '{}'), '{tags}',
          (select coalesce(jsonb_agg(distinct x), '[]') from jsonb_array_elements_text(
             coalesce(props -> 'tags', '[]') || to_jsonb(lower(regexp_replace(p_effect ->> 'tag', '^#', '')))) x))
        where id = v_id;
      end if;
      return jsonb_build_object('pagina', v_id);
    when 'pagina.criar_de_modelo' then
      v_id := gen_random_uuid();
      insert into public.notes (id, user_id, title, body, props, folder_id)
      select v_id, p_rule.owner_id, left(coalesce(nullif(p_effect ->> 'titulo', ''), n.title), 200), n.body,
             coalesce(n.props, '{}'), null
      from public.notes n where n.id = (p_effect ->> 'modelo')::uuid and public.can_see_note(n.id);
      if not found then
        raise exception 'Modelo de anotação não encontrado';
      end if;
      return jsonb_build_object('pagina', v_id);
    when 'iniciar_processo' then
      if not exists (select 1 from public.process_definitions where id = (p_effect ->> 'processo')::uuid
                     and owner_id = p_rule.owner_id and active) then
        raise exception 'Processo não encontrado ou desligado';
      end if;
      v_id := public._process_start((p_effect ->> 'processo')::uuid, p_rule.owner_id, coalesce(p_effect -> 'variaveis', '{}'),
        jsonb_build_object('tipo', 'regra', 'regra', p_rule.id), coalesce(p_run.state -> 'evento', '{}'),
        case when p_run.state #>> '{evento,pagina}' ~ '^[0-9a-f-]{36}$' then (p_run.state #>> '{evento,pagina}')::uuid end,
        null, null, 0);
      return jsonb_build_object('instancia', v_id);
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

-- O efeito de um processo marca a definição durante a ação (anti-laço do PR7)
create or replace function public._process_effect(p_inst public.process_instances, p_effect jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules;
  v_run public.automation_runs;
  v_claims text := current_setting('request.jwt.claims', true);
  v_marca text := current_setting('questlist.process_def', true);
  v_out jsonb;
begin
  v_rule.id := p_inst.definition_id;
  v_rule.owner_id := p_inst.owner_id;
  v_rule.scope := 'pessoal';
  v_rule.name := (select name from public.process_definitions where id = p_inst.definition_id);
  v_rule.enabled := true;
  v_run.id := p_inst.id;
  v_run.state := jsonb_build_object('evento', p_inst.start_data || jsonb_strip_nulls(jsonb_build_object('pagina', p_inst.page_id)), 'var', p_inst.vars);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_inst.owner_id, 'role', 'authenticated')::text, true);
  perform set_config('questlist.process_def', p_inst.definition_id::text, true);
  v_out := public._automation_effect(v_run, v_rule, p_effect);
  perform set_config('questlist.process_def', coalesce(v_marca, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_out;
end;
$$;

-- Iniciar os processos da pessoa ligados ao gatilho da página (o início do grafo diz qual e o filtro)
create function public._process_page_start(p_kind text, p_note public.notes, p_owner uuid, p_dados jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_def record;
  v_gat jsonb;
begin
  if coalesce(current_setting('questlist.bulk', true), '') = '1' or p_owner is null then
    return;
  end if;
  for v_def in
    select d.id, (select n -> 'gatilho' from jsonb_array_elements(v.graph -> 'nos') n where n ->> 'tipo' = 'inicio') as gatilho
    from public.process_definitions d
    join lateral (select * from public.process_versions x where x.definition_id = d.id order by x.number desc limit 1) v on true
    where d.owner_id = p_owner and d.active and d.start_trigger = p_kind
  loop
    v_gat := v_def.gatilho;
    -- Anti-laço: a ação deste processo mudou a página; ele não começa de novo por isso
    continue when coalesce(current_setting('questlist.process_def', true), '') = v_def.id::text;
    continue when p_kind = 'pagina.propriedade_mudou' and v_gat ? 'propriedade'
      and lower(v_gat ->> 'propriedade') <> lower(p_dados ->> 'propriedade');
    continue when p_kind = 'pagina.propriedade_mudou' and v_gat ? 'valor'
      and lower(v_gat ->> 'valor') <> lower(p_dados #>> '{valor}');
    continue when p_kind = 'pagina.marcada_como' and v_gat ? 'marca'
      and lower(v_gat ->> 'marca') <> lower(p_dados ->> 'marca');
    continue when p_kind = 'pagina.tag_adicionada' and v_gat ? 'tag'
      and lower(regexp_replace(v_gat ->> 'tag', '^#', '')) <> lower(p_dados ->> 'tag');
    perform public._process_start(v_def.id, p_owner, '{}',
      jsonb_build_object('tipo', 'pagina', 'evento', p_kind), p_dados || jsonb_build_object('pagina', p_note.id, 'titulo', p_note.title),
      p_note.id, null, null, 0);
  end loop;
end;
$$;

create function public.notes_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := coalesce(auth.uid(), new.user_id);
  v_key text;
  v_tag text;
  v_dados jsonb;
begin
  if coalesce(current_setting('questlist.bulk', true), '') = '1' or new.is_template then
    return null;
  end if;
  if tg_op = 'INSERT' then
    v_dados := jsonb_build_object('pagina', new.id, 'titulo', new.title);
    perform public.automation_emit('pagina.criada', v_dados, v_owner, null, 'pc|' || new.id);
    perform public._process_page_start('pagina.criada', new, v_owner, v_dados);
    return null;
  end if;
  -- Propriedades guardadas que mudaram (as etiquetas à parte)
  for v_key in
    select k from jsonb_object_keys(coalesce(new.props, '{}')) k
    where k <> 'tags' and (old.props -> k) is distinct from (new.props -> k)
  loop
    v_dados := jsonb_build_object('pagina', new.id, 'titulo', new.title, 'propriedade', v_key,
                                  'valor', new.props -> v_key, 'antes', old.props -> v_key);
    perform public.automation_emit('pagina.propriedade_mudou', v_dados, v_owner, null);
    perform public._process_page_start('pagina.propriedade_mudou', new, v_owner, v_dados);
  end loop;
  for v_tag in
    select t from jsonb_array_elements_text(coalesce(to_jsonb(new.tags), '[]')) t
    where not coalesce(to_jsonb(old.tags), '[]') ? t
  loop
    v_dados := jsonb_build_object('pagina', new.id, 'titulo', new.title, 'tag', v_tag);
    perform public.automation_emit('pagina.tag_adicionada', v_dados, v_owner, null);
    perform public._process_page_start('pagina.tag_adicionada', new, v_owner, v_dados);
  end loop;
  return null;
end;
$$;
create trigger notes_events after insert or update of body, props, tags on public.notes
  for each row execute function public.notes_events();

-- Marcar a página (o botão do ED4): o gatilho `pagina.marcada_como`
create function public.note_mark(p_note uuid, p_marca text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.notes;
  v_dados jsonb;
begin
  select * into v_note from public.notes where id = p_note;
  if v_note.id is null or not public.can_see_note(p_note) then
    raise exception 'Anotação não encontrada' using errcode = '42501';
  end if;
  v_dados := jsonb_build_object('pagina', v_note.id, 'titulo', v_note.title, 'marca', left(p_marca, 80));
  perform public.automation_emit('pagina.marcada_como', v_dados, auth.uid(), null);
  perform public._process_page_start('pagina.marcada_como', v_note, auth.uid(), v_dados);
end;
$$;

revoke execute on function public._process_page_start(text, public.notes, uuid, jsonb), public.notes_events(),
  public._automation_effect(public.automation_runs, public.automation_rules, jsonb),
  public._automation_check_steps(jsonb, text, integer), public._process_effect(public.process_instances, jsonb)
  from public, anon, authenticated;
revoke execute on function public.note_mark(uuid, text) from public, anon;
grant execute on function public.note_mark(uuid, text) to authenticated;
