-- Botões nas anotações (ESCOPO_V16 ED4, D360). Um bloco ```questlist-button com JSON roda uma ação
-- do registro do V14 como uma execução de verdade (expansão de {{ }}, histórico, efeito externo
-- pelo executor), presa a uma regra escondida por pessoa ("Botões das anotações", `sistema`).
-- Webhook e dispositivo pedem confirmação; dado sensível do V15 (saude.*, local.*, camera.*,
-- dispositivo.*) é recusado (V16 §1.7). A marca (`marcar`) só emite `pagina.marcada_como`.

-- `can_see_note` confia na RLS de quem chama: dentro de `security definer` ela não vale e a
-- resposta seria sempre sim. Estas funções conferem pela mesma regra da policy de leitura.
create function public._note_visible(p_note uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note
      and ((n.folder_id is null and (n.user_id = (select auth.uid()) or public._note_shared(n.id, false)))
           or (n.folder_id is not null and public.is_folder_member(n.folder_id, 'viewer'))))
$$;
revoke execute on function public._note_visible(uuid) from public, anon, authenticated;

-- Marcar e "criar de modelo" (PR7) passam a conferir assim
create or replace function public.note_mark(p_note uuid, p_marca text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_note public.notes;
  v_dados jsonb;
begin
  select * into v_note from public.notes where id = p_note;
  if v_note.id is null or not public._note_visible(p_note) then
    raise exception 'Anotação não encontrada' using errcode = '42501';
  end if;
  v_dados := jsonb_build_object('pagina', v_note.id, 'titulo', v_note.title, 'marca', left(p_marca, 80));
  perform public.automation_emit('pagina.marcada_como', v_dados, auth.uid(), null);
  perform public._process_page_start('pagina.marcada_como', v_note, auth.uid(), v_dados);
end;
$$;

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
      from public.notes n where n.id = (p_effect ->> 'modelo')::uuid and public._note_visible(n.id);
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

create function public.note_button_run(p_note uuid, p_rotulo text, p_acao jsonb, p_confirmado boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.notes;
  v_rule public.automation_rules;
  v_tipo text := p_acao ->> 'tipo';
  v_meta jsonb;
  v_motivo text;
  v_run uuid;
begin
  select * into v_note from public.notes where id = p_note;
  if v_note.id is null or not public._note_visible(p_note) then
    raise exception 'Anotação não encontrada' using errcode = '42501';
  end if;
  if jsonb_typeof(p_acao) <> 'object' or v_tipo is null then
    raise exception 'Botão sem ação' using errcode = '22023';
  end if;
  if p_acao::text ~* '\{\{\s*(saude|local|camera|dispositivo)\.' then
    raise exception 'O botão não pode ler dado sensível (saúde, local, câmera, dispositivo)' using errcode = '22023';
  end if;
  if v_tipo = 'marcar' then
    perform public.note_mark(p_note, coalesce(nullif(p_acao ->> 'marca', ''), p_rotulo));
    return jsonb_build_object('marcou', true);
  end if;
  v_meta := public.automation_catalog() #> array['passos', v_tipo];
  if v_meta is null or v_tipo in ('esperar', 'se', 'parar', 'definir_variavel') then
    raise exception 'Ação de botão desconhecida: %', v_tipo using errcode = '22023';
  end if;
  if (v_meta ->> 'externo')::boolean is true and not p_confirmado then
    raise exception 'Esta ação mexe em webhook ou dispositivo: confirme' using errcode = '22023';
  end if;
  -- Criar tarefa sem lista: vai para a Caixa de entrada de quem apertou
  if v_tipo = 'criar_tarefa' and coalesce(p_acao ->> 'lista', '') = '' then
    p_acao := p_acao || jsonb_build_object('lista', (
      select p.id from public.pages p join public.folders f on f.id = p.folder_id
      where f.owner_id = auth.uid() and f.is_inbox and p.is_inbox limit 1));
  end if;
  perform public._automation_check_steps(jsonb_build_array(p_acao), 'pessoal', 0);

  select * into v_rule from public.automation_rules
  where owner_id = auth.uid() and scope = 'pessoal' and definition ->> 'sistema' = 'botoes';
  if v_rule.id is null then
    insert into public.automation_rules (scope, owner_id, folder_id, name, enabled, definition, trigger_type)
    values ('pessoal', auth.uid(), null, 'Botões das anotações', true,
            '{"v": 1, "sistema": "botoes", "gatilho": {"tipo": "manual"}, "passos": [{"tipo": "parar"}]}', 'manual')
    returning * into v_rule;
  end if;
  v_motivo := public._automation_limited(v_rule);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = '22023';
  end if;
  insert into public.automation_runs (rule_id, state, definition, status)
  values (v_rule.id,
          jsonb_build_object('evento', jsonb_build_object('pagina', v_note.id, 'titulo', v_note.title, 'botao', left(p_rotulo, 80)),
                             'var', '{}'::jsonb),
          jsonb_build_object('v', 1, 'gatilho', jsonb_build_object('tipo', 'manual'), 'passos', jsonb_build_array(p_acao)),
          'pendente')
  returning id into v_run;
  perform public._automation_kick();
  return jsonb_build_object('execucao', v_run);
end;
$$;

revoke execute on function public.note_button_run(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.note_button_run(uuid, text, jsonb, boolean) to authenticated;
