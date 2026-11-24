-- ESCOPO_V14 (AU1, D332, D333): tabelas do motor de automações e do conector Smart Life.
--
-- A tabela `automation_rules` já existia (automações de projeto da D143). O dono escolheu absorvê-las
-- (D332, opção (a)): a mesma tabela ganha o formato novo (`definition`, em jsonb, com gatilho,
-- condições e passos) e o escopo `pessoal` ou `projeto`. As colunas antigas (`trigger`, `action`,
-- `params`) ficam até o executor novo assumir (AU2 a AU5): enquanto isso, a regra antiga continua
-- rodando como antes e a `definition` dela é derivada das colunas antigas a cada gravação.
--
-- A validação da `definition` é do banco (trigger), porque o sync grava direto na tabela.

-- ---------------------------------------------------------------------------------------------
-- Catálogo: os ids que o motor conhece e em que escopo cada um vale. O registro do app
-- (`lib/automation/registry.ts`, AU2) é o espelho; o teste compara os dois.
-- ---------------------------------------------------------------------------------------------
create function public.automation_catalog()
returns jsonb
language sql immutable set search_path = ''
as $$
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
      'manual',           jsonb_build_object('escopos', jsonb_build_array('pessoal', 'projeto'))),
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
      'alternar_modo_jogo',   jsonb_build_object('escopos', jsonb_build_array('pessoal'), 'externo', false)),
    'operadores', jsonb_build_array('=', '≠', '<', '≤', '>', '≥', 'contem', 'comeca_com', 'em', 'vazio'),
    'prontas', jsonb_build_array('janela_horario', 'dias_semana', 'projeto', 'lista', 'etiqueta', 'nivel_min'));
$$;
grant execute on function public.automation_catalog() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Validação (V14 §2, §4, §5, §6.4). Erros em português, código 22023.
-- ---------------------------------------------------------------------------------------------
create function public._automation_fail(p_message text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = '22023';
end;
$$;

-- Condição: E/OU/NÃO até 3 níveis; devolve quantas comparações tem
create function public._automation_check_condition(p_node jsonb, p_level integer)
returns integer
language plpgsql immutable set search_path = ''
as $$
declare
  v_count integer := 0;
  v_child jsonb;
  v_key text;
begin
  if jsonb_typeof(p_node) <> 'object' then
    perform public._automation_fail('Condição inválida');
  end if;
  if p_node ? 'e' or p_node ? 'ou' then
    if p_level >= 3 then
      perform public._automation_fail('Condições com no máximo 3 níveis de E/OU/NÃO');
    end if;
    v_key := case when p_node ? 'e' then 'e' else 'ou' end;
    if jsonb_typeof(p_node -> v_key) <> 'array' or jsonb_array_length(p_node -> v_key) = 0 then
      perform public._automation_fail('E/OU precisa de uma lista de condições');
    end if;
    for v_child in select value from jsonb_array_elements(p_node -> v_key) loop
      v_count := v_count + public._automation_check_condition(v_child, p_level + 1);
    end loop;
    return v_count;
  elsif p_node ? 'nao' then
    if p_level >= 3 then
      perform public._automation_fail('Condições com no máximo 3 níveis de E/OU/NÃO');
    end if;
    return public._automation_check_condition(p_node -> 'nao', p_level + 1);
  elsif p_node ? 'pronta' then
    if not (public.automation_catalog() -> 'prontas') ? (p_node ->> 'pronta') then
      perform public._automation_fail('Condição pronta desconhecida: ' || coalesce(p_node ->> 'pronta', ''));
    end if;
    return 1;
  elsif p_node ? 'campo' then
    if not (public.automation_catalog() -> 'operadores') ? coalesce(p_node ->> 'op', '') then
      perform public._automation_fail('Operador desconhecido: ' || coalesce(p_node ->> 'op', ''));
    end if;
    if char_length(p_node ->> 'campo') > 120 then
      perform public._automation_fail('Campo longo demais');
    end if;
    return 1;
  end if;
  perform public._automation_fail('Condição inválida');
  return 0;
end;
$$;

-- Passos: tipo conhecido no escopo, parâmetros básicos, SE aninhado até 3; devolve quantos passos
create function public._automation_check_steps(p_steps jsonb, p_scope text, p_level integer)
returns integer
language plpgsql immutable set search_path = ''
as $$
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

-- Regras chamadas por `executar_regra` (em qualquer nível de SE)
create function public._automation_called_rules(p_definition jsonb)
returns setof uuid
language sql immutable set search_path = ''
as $$
  select distinct (value #>> '{}')::uuid
  from jsonb_path_query(p_definition, 'lax $.** ? (@.tipo == "executar_regra").regra') as value
  where value #>> '{}' ~ '^[0-9a-f-]{36}$';
$$;

create function public.automation_validate(
  p_definition jsonb, p_scope text, p_owner uuid, p_folder uuid, p_rule_id uuid
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_trigger text := p_definition #>> '{gatilho,tipo}';
  v_catalog jsonb := public.automation_catalog();
  v_steps integer;
  v_target uuid;
  v_text text;
  v_cycle boolean;
  v_depth integer;
begin
  if jsonb_typeof(p_definition) <> 'object' or coalesce(p_definition ->> 'v', '') <> '1' then
    perform public._automation_fail('Formato da automação desconhecido');
  end if;
  if pg_column_size(p_definition) > 32000 then
    perform public._automation_fail('Automação grande demais');
  end if;
  -- Textos depois de expandidos têm até 2.000 caracteres (V14 §2.1); aqui, o texto cru
  for v_text in select value #>> '{}' from jsonb_path_query(p_definition, 'lax $.** ? (@.type() == "string")') as value loop
    if char_length(v_text) > 2000 then
      perform public._automation_fail('Texto com mais de 2.000 caracteres');
    end if;
  end loop;

  -- Gatilho
  if v_trigger is null or not (v_catalog -> 'gatilhos') ? v_trigger then
    perform public._automation_fail('Gatilho desconhecido: ' || coalesce(v_trigger, '?'));
  end if;
  if not (v_catalog -> 'gatilhos' -> v_trigger -> 'escopos') ? p_scope then
    perform public._automation_fail('O gatilho ' || v_trigger || ' não vale para regra de ' || p_scope);
  end if;
  case v_trigger
    when 'horario' then
      if coalesce(p_definition #>> '{gatilho,hora}', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        perform public._automation_fail('Horário no formato HH:MM');
      end if;
      if exists (select 1 from jsonb_array_elements_text(coalesce(p_definition #> '{gatilho,dias}', '[]')) d
                 where d !~ '^[0-6]$') then
        perform public._automation_fail('Dias da semana de 0 (domingo) a 6');
      end if;
    when 'intervalo' then
      if coalesce((p_definition #>> '{gatilho,horas}')::numeric, 0) not between 1 and 24 then
        perform public._automation_fail('Intervalo de 1 a 24 horas');
      end if;
    when 'tarefa.vencendo' then
      if coalesce((p_definition #>> '{gatilho,minutos}')::numeric, 0) not between 5 and 1440 then
        perform public._automation_fail('Aviso antes do vencimento: de 5 a 1.440 minutos');
      end if;
    else
      null;
  end case;

  -- Condições: até 3 níveis e 10 comparações
  if p_definition ? 'condicoes' and jsonb_typeof(p_definition -> 'condicoes') <> 'null' then
    if public._automation_check_condition(p_definition -> 'condicoes', 0) > 10 then
      perform public._automation_fail('No máximo 10 comparações por automação');
    end if;
  end if;

  -- Passos: de 1 a 20, contando os de dentro dos SE
  v_steps := public._automation_check_steps(coalesce(p_definition -> 'passos', 'null'), p_scope, 0);
  if v_steps < 1 or v_steps > 20 then
    perform public._automation_fail('A automação precisa de 1 a 20 passos');
  end if;

  -- Limites
  if coalesce((p_definition #>> '{limites,cooldown_min}')::numeric, 0) not between 0 and 1440
     or coalesce((p_definition #>> '{limites,atraso_max_min}')::numeric, 15) not between 1 and 1440 then
    perform public._automation_fail('Limites: espera entre execuções até 24 h, atraso de 1 min a 24 h');
  end if;

  -- executar_regra: regra existente, do mesmo dono e escopo, sem ciclo e até 3 de profundidade
  for v_target in select public._automation_called_rules(p_definition) loop
    if v_target = p_rule_id or not exists (
      select 1 from public.automation_rules r
      where r.id = v_target and r.scope = p_scope
        and (case when p_scope = 'pessoal' then r.owner_id = p_owner else r.folder_id = p_folder end)
    ) then
      perform public._automation_fail('Executar regra: a regra precisa ser outra, sua e do mesmo tipo');
    end if;
  end loop;
  with recursive chain (rule_id, depth, path) as (
    select c, 1, array[p_rule_id, c] from public._automation_called_rules(p_definition) as c
    union all
    select n, chain.depth + 1, chain.path || n
    from chain
    join public.automation_rules r on r.id = chain.rule_id
    cross join lateral public._automation_called_rules(r.definition) as n
    where chain.depth < 6 and not (n = any (chain.path[2:]))
  )
  select bool_or(rule_id = p_rule_id), max(depth) into v_cycle, v_depth from chain;
  if coalesce(v_cycle, false) then
    perform public._automation_fail('Executar regra: as regras se chamariam em círculo');
  end if;
  if coalesce(v_depth, 0) > 3 then
    perform public._automation_fail('Executar regra: no máximo 3 regras encadeadas');
  end if;
end;
$$;
revoke execute on function public.automation_validate(jsonb, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.automation_validate(jsonb, text, uuid, uuid, uuid) to authenticated;

-- Regra antiga (D143) no formato novo
create function public._automation_from_legacy(p_trigger text, p_action text, p_params jsonb, p_page uuid)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'v', 1,
    'gatilho', jsonb_strip_nulls(jsonb_build_object(
      'tipo', case p_trigger
        when 'task_done' then 'tarefa.concluida'
        when 'task_ready' then 'tarefa.pronta'
        when 'task_assigned' then 'tarefa.atribuida'
        when 'page_done' then 'lista.concluida'
        when 'task_overdue' then 'tarefa.atrasada' end,
      'lista', p_page)),
    'condicoes', null,
    'passos', jsonb_build_array(jsonb_strip_nulls(case p_action
      when 'create_task' then jsonb_build_object(
        'tipo', 'criar_tarefa',
        'titulo', coalesce(nullif(btrim(p_params ->> 'title'), ''), 'Nova tarefa'),
        'lista', p_params ->> 'page_id')
      when 'assign' then jsonb_build_object('tipo', 'atribuir', 'pessoa', p_params ->> 'user_id')
      when 'notify' then jsonb_build_object(
        'tipo', 'notificar',
        'para', case when p_params ->> 'user_id' is not null then 'pessoa'
                     when p_params ->> 'to' = 'assignees' then 'responsaveis' else 'dona' end,
        'pessoa', p_params ->> 'user_id',
        'corpo', left(p_params ->> 'message', 240),
        'canal', 'ambos')
      when 'add_label' then jsonb_build_object(
        'tipo', 'atualizar_tarefa',
        'adicionar_etiquetas', jsonb_build_array(lower(regexp_replace(coalesce(p_params ->> 'label', ''), '^#', ''))))
      when 'move' then jsonb_build_object('tipo', 'atualizar_tarefa', 'mover_para', p_params ->> 'page_id')
      when 'rest_timer' then jsonb_build_object(
        'tipo', 'descanso', 'segundos', least(greatest(coalesce((p_params ->> 'seconds')::integer, 60), 5), 3600))
    end)),
    'limites', jsonb_build_object('cooldown_min', 0, 'atraso_max_min', 15));
$$;

create function public._automation_legacy_name(p_trigger text, p_action text)
returns text
language sql immutable set search_path = ''
as $$
  select (case p_trigger
      when 'task_done' then 'Ao concluir'
      when 'task_ready' then 'Quando fica pronta'
      when 'task_assigned' then 'Ao atribuir'
      when 'page_done' then 'Ao concluir a lista'
      when 'task_overdue' then 'Quando atrasa' end)
    || ': ' ||
    (case p_action
      when 'create_task' then 'criar tarefa'
      when 'assign' then 'atribuir'
      when 'notify' then 'avisar'
      when 'add_label' then 'pôr etiqueta'
      when 'move' then 'mover'
      when 'rest_timer' then 'descanso' end);
$$;

-- ---------------------------------------------------------------------------------------------
-- automation_rules: formato novo
-- ---------------------------------------------------------------------------------------------
alter table public.automation_rules
  alter column folder_id drop not null,
  alter column trigger drop not null,
  alter column action drop not null,
  add column scope text not null default 'projeto' check (scope in ('pessoal', 'projeto')),
  add column owner_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  add column name text not null default '' check (char_length(name) <= 80),
  add column definition jsonb not null default '{}',
  -- Colunas do servidor
  add column trigger_type text,
  add column next_run_at timestamptz,
  add column consecutive_failures integer not null default 0,
  add column disabled_reason text check (disabled_reason in ('falhas', 'conector', 'dona')),
  add column updated_at timestamptz not null default now(),
  add constraint automation_rules_scope_shape check (
    (scope = 'pessoal' and folder_id is null and page_id is null and owner_id is not null and trigger is null)
    or (scope = 'projeto' and folder_id is not null));

-- As de projeto (D143) passam a rodar como quem criou (D333). Sem o trigger: a dona "muda" de nula
-- para quem criou, o que a regra nova recusa
alter table public.automation_rules disable trigger automation_rules_check;
update public.automation_rules set
  owner_id = created_by,
  definition = public._automation_from_legacy(trigger, action, params, page_id),
  name = public._automation_legacy_name(trigger, action),
  trigger_type = public._automation_from_legacy(trigger, action, params, page_id) #>> '{gatilho,tipo}';
alter table public.automation_rules enable trigger automation_rules_check;

-- Quem não usa automação não paga nada (V14 §6.2): o emissor olha só este índice
create index automation_rules_owner_trigger on public.automation_rules (owner_id, trigger_type) where enabled;
create index automation_rules_folder_trigger on public.automation_rules (folder_id, trigger_type) where enabled;
create index automation_rules_next_run on public.automation_rules (next_run_at) where enabled and next_run_at is not null;

create or replace function public.automation_rules_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := coalesce(auth.uid(), new.owner_id, new.created_by);
    new.consecutive_failures := 0;
    new.disabled_reason := null;
    new.runs := 0;
    new.last_run_at := null;
  elsif new.scope <> old.scope or new.owner_id is distinct from old.owner_id
        or new.folder_id is distinct from old.folder_id then
    perform public._automation_fail('Escopo, dona e projeto da automação não mudam');
  end if;

  if new.scope = 'projeto' then
    if (select parent_id from public.folders where id = new.folder_id) is not null then
      perform public._automation_fail('A regra vale para a pasta principal (o projeto)');
    end if;
    if new.page_id is not null and (select public.folder_root(folder_id) from public.pages where id = new.page_id) <> new.folder_id then
      perform public._automation_fail('A página precisa ser desta pasta');
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.automation_rules where folder_id = new.folder_id) >= 20 then
      perform public._automation_fail('No máximo 20 automações por projeto');
    end if;
  elsif tg_op = 'INSERT' and (select count(*) from public.automation_rules where owner_id = new.owner_id and scope = 'pessoal') >= 100 then
    perform public._automation_fail('No máximo 100 automações pessoais');
  end if;

  -- Regra antiga (D143): a definição vem das colunas antigas, que a tela antiga ainda grava
  if new.trigger is not null then
    new.definition := public._automation_from_legacy(new.trigger, new.action, new.params, new.page_id);
    if new.name = '' then
      new.name := public._automation_legacy_name(new.trigger, new.action);
    end if;
  elsif char_length(btrim(new.name)) = 0 then
    perform public._automation_fail('A automação precisa de um nome');
  end if;

  perform public.automation_validate(new.definition, new.scope, new.owner_id, new.folder_id, new.id);
  new.trigger_type := new.definition #>> '{gatilho,tipo}';

  -- Religar zera as falhas
  if tg_op = 'UPDATE' and new.enabled and not old.enabled then
    new.consecutive_failures := 0;
    new.disabled_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop policy "automation_rules_select" on public.automation_rules;
drop policy "automation_rules_write" on public.automation_rules;
create policy "automation_rules_select" on public.automation_rules for select to authenticated
  using ((scope = 'pessoal' and owner_id = auth.uid())
         or (scope = 'projeto' and public.is_folder_member(folder_id)));
create policy "automation_rules_write" on public.automation_rules for all to authenticated
  using ((scope = 'pessoal' and owner_id = auth.uid())
         or (scope = 'projeto' and public.has_permission(folder_id, 'automation.manage')))
  with check ((scope = 'pessoal' and owner_id = auth.uid())
              or (scope = 'projeto' and public.has_permission(folder_id, 'automation.manage')));
grant insert (scope, name, definition), update (name, definition) on public.automation_rules to authenticated;

drop policy "automation_log_select" on public.automation_log;
create policy "automation_log_select" on public.automation_log for select to authenticated
  using (exists (select 1 from public.automation_rules r where r.id = rule_id));

-- Regra visível para quem pede (as policies de automation_rules decidem)
create function public.can_see_automation_rule(p_rule uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.automation_rules r
    where r.id = p_rule
      and ((r.scope = 'pessoal' and r.owner_id = auth.uid())
           or (r.scope = 'projeto' and public.is_folder_member(r.folder_id))));
$$;
grant execute on function public.can_see_automation_rule(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fila de eventos (outbox): só o servidor lê e grava
-- ---------------------------------------------------------------------------------------------
create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 8192),
  dedupe_key text,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  processed_at timestamptz,
  attempts integer not null default 0,
  check (owner_id is not null or folder_id is not null)
);
create unique index automation_events_dedupe on public.automation_events (dedupe_key) where dedupe_key is not null;
create index automation_events_pending on public.automation_events (available_at) where processed_at is null;
create index automation_events_created on public.automation_events (created_at);
alter table public.automation_events enable row level security;
revoke all on public.automation_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Execuções: uma por (regra, evento)
-- ---------------------------------------------------------------------------------------------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  event_id uuid,
  status text not null default 'pendente' check (status in (
    'pendente', 'rodando', 'esperando', 'ok', 'falhou', 'limitada', 'perdido', 'teste', 'cancelada')),
  step integer not null default 0,
  state jsonb not null default '{}',
  resume_at timestamptz,
  attempts integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  detail text,
  warnings jsonb not null default '[]',
  steps jsonb not null default '[]',
  unique (rule_id, event_id)
);
create index automation_runs_rule on public.automation_runs (rule_id, started_at desc);
create index automation_runs_waiting on public.automation_runs (resume_at) where status = 'esperando';
create index automation_runs_started on public.automation_runs (started_at);
alter table public.automation_runs enable row level security;
create policy "automation_runs_select" on public.automation_runs for select to authenticated
  using (public.can_see_automation_rule(rule_id));
revoke insert, update, delete, truncate on public.automation_runs from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Webhook de entrada: o token só como hash (AU9)
-- ---------------------------------------------------------------------------------------------
create table public.automation_hooks (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null unique references public.automation_rules (id) on delete cascade,
  token_hash text not null unique,
  require_signature boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.automation_hooks enable row level security;
create policy "automation_hooks_select" on public.automation_hooks for select to authenticated
  using (public.can_see_automation_rule(rule_id));
revoke all on public.automation_hooks from anon, authenticated;
grant select (id, rule_id, require_signature, last_used_at, created_at) on public.automation_hooks to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Conector (Tuya) e segredos: o cliente vê só o estado
-- ---------------------------------------------------------------------------------------------
create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('tuya')),
  status text not null default 'desconectado'
    check (status in ('conectado', 'erro', 'assinatura_vencida', 'desconectado')),
  data_center text,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind)
);
alter table public.connectors enable row level security;
create policy "connectors_select" on public.connectors for select to authenticated
  using (owner_id = auth.uid());
revoke insert, update, delete, truncate on public.connectors from anon, authenticated;

-- O segredo mora no Vault; aqui só o id dele. Nem leitura para o cliente
create table public.connector_secrets (
  connector_id uuid primary key references public.connectors (id) on delete cascade,
  secret_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.connector_secrets enable row level security;
revoke all on public.connector_secrets from anon, authenticated;

create function public.connector_secrets_cleanup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return null;
end;
$$;
create trigger connector_secrets_cleanup after delete on public.connector_secrets
  for each row execute function public.connector_secrets_cleanup();
revoke execute on function public.connector_secrets_cleanup() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Dispositivos e fila de comandos
-- ---------------------------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  connector_id uuid not null references public.connectors (id) on delete cascade,
  external_id text not null,
  parent_external_id text,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category text not null,
  capabilities jsonb not null default '{}',
  state jsonb not null default '{}',
  state_at timestamptz,
  presumed boolean not null default false,
  online boolean,
  hidden boolean not null default false,
  sensitive boolean not null default false,
  last_command_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connector_id, external_id)
);
create index devices_owner on public.devices (owner_id);
alter table public.devices enable row level security;
create policy "devices_select" on public.devices for select to authenticated using (owner_id = auth.uid());
create policy "devices_update" on public.devices for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update, delete, truncate on public.devices from anon, authenticated;
grant update (name, hidden, sensitive) on public.devices to authenticated;

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  run_id uuid,
  idem_key text not null unique,
  command jsonb not null,
  via text not null default 'nuvem' check (via in ('nuvem', 'ponte')),
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'ok', 'falhou', 'expirado', 'recusado')),
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  result jsonb
);
create index device_commands_pending on public.device_commands (owner_id, created_at) where status = 'pendente';
alter table public.device_commands enable row level security;
revoke all on public.device_commands from anon, authenticated;

-- Ponte doméstica (SL4): o token só como hash
create table public.bridges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  token_hash text not null unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.bridges enable row level security;
create policy "bridges_select" on public.bridges for select to authenticated using (owner_id = auth.uid());
revoke all on public.bridges from anon, authenticated;
grant select (id, owner_id, name, last_seen_at, created_at, revoked_at) on public.bridges to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Sync (PowerSync): as regras pessoais, o estado dos conectores e os dispositivos
-- ---------------------------------------------------------------------------------------------
alter publication powersync add table public.automation_rules, public.connectors, public.devices;

revoke execute on function public._automation_fail(text), public._automation_check_condition(jsonb, integer),
  public._automation_check_steps(jsonb, text, integer), public._automation_called_rules(jsonb),
  public._automation_from_legacy(text, text, jsonb, uuid), public._automation_legacy_name(text, text)
  from public, anon, authenticated;
