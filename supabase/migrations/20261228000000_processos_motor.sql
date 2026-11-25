-- Processos: o motor (ESCOPO_V16 PR4, D352). O mesmo executor das automações (Edge Function
-- `automation-run`) reivindica tokens prontos (`process_claim`, FOR UPDATE SKIP LOCKED), decide o
-- passo com o módulo compartilhado (_shared/processo.ts) e grava tudo numa transação só
-- (`process_advance`): histórico, variáveis, tokens seguintes, junção do paralelo, esperas, efeito
-- interno da ação do V14 (como a dona) e o fim. Só a reivindicação vigente grava (a de um executor
-- que caiu volta depois de 2 minutos e o passo não se repete). O varredor do pg_cron resolve
-- temporizadores e prazos por índice de vencimento (instâncias paradas não custam nada).

alter table public.process_tokens drop constraint process_tokens_status_check;
alter table public.process_tokens add constraint process_tokens_status_check
  check (status in ('pronto', 'rodando', 'esperando', 'concluido', 'cancelado', 'falhou'));
alter table public.process_definitions add column fail_streak integer not null default 0;

-- ---------------------------------------------------------------------------------------------
-- Reivindicar
-- ---------------------------------------------------------------------------------------------
create function public.process_claim(p_limit integer default 20)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_out jsonb;
begin
  with alvo as (
    select t.id from public.process_tokens t
    join public.process_instances i on i.id = t.instance_id
    join public.profiles p on p.id = i.owner_id
    where i.status = 'em_andamento' and not p.automations_paused
      and ((t.status = 'pronto' and (t.resume_at is null or t.resume_at <= now()))
           or (t.status = 'rodando' and t.claimed_at < now() - interval '2 minutes'))
    order by t.created_at
    for update of t skip locked
    limit greatest(least(p_limit, 200), 1)
  ), feito as (
    update public.process_tokens t
    set status = 'rodando', claimed_at = clock_timestamp(), attempts = t.attempts + 1, updated_at = now()
    from alvo where t.id = alvo.id
    returning t.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'token', f.id, 'claimed_at', f.claimed_at, 'node', f.node_id, 'scope', f.scope, 'result', f.result,
    'retries', f.retries, 'instance', i.id, 'vars', i.vars, 'start', i.start_data, 'page', i.page_id,
    'graph', v.graph, 'definition', i.definition_id, 'name', d.name,
    'fuso', coalesce(p.timezone, 'America/Sao_Paulo'), 'idioma', coalesce(p.locale, 'pt-BR'),
    'usuario', jsonb_build_object('nome', p.display_name, 'nivel', p.level, 'sequencia', p.streak, 'xp', p.xp))), '[]')
  into v_out
  from feito f
  join public.process_instances i on i.id = f.instance_id
  join public.process_versions v on v.id = i.version_id
  join public.process_definitions d on d.id = i.definition_id
  join public.profiles p on p.id = i.owner_id;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Efeito de uma tarefa de serviço: a ação do V14, como a dona (D333), pelo mesmo `_automation_effect`
-- ---------------------------------------------------------------------------------------------
create function public._process_effect(p_inst public.process_instances, p_effect jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules;
  v_run public.automation_runs;
  v_claims text := current_setting('request.jwt.claims', true);
  v_out jsonb;
begin
  v_rule.id := p_inst.definition_id;
  v_rule.owner_id := p_inst.owner_id;
  v_rule.scope := 'pessoal';
  v_rule.name := (select name from public.process_definitions where id = p_inst.definition_id);
  v_rule.enabled := true;
  v_run.id := p_inst.id;
  v_run.state := jsonb_build_object('evento', p_inst.start_data, 'var', p_inst.vars);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_inst.owner_id, 'role', 'authenticated')::text, true);
  v_out := public._automation_effect(v_run, v_rule, p_effect);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_out;
end;
$$;

-- Próximos tokens a partir de uma lista [{no, escopo}]
create function public._process_spawn(p_instance uuid, p_proximos jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.process_tokens (instance_id, node_id, scope)
  select p_instance, x ->> 'no', coalesce(x -> 'escopo', '{}')
  from jsonb_array_elements(coalesce(p_proximos, '[]')) x;
$$;

-- O caminho de erro de um nó (ou nenhum)
create function public._process_error_path(p_graph jsonb, p_node text)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('no', a ->> 'para')), '[]')
  from jsonb_array_elements(p_graph -> 'arestas') a
  where a ->> 'de' = p_node and (a ->> 'erro')::boolean is true;
$$;

-- Fim de uma instância filha: devolve as saídas à espera da mãe (subprocesso e multi-instância)
create function public._process_child_done(p_child public.process_instances)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits;
  v_sig jsonb := (select signature from public.process_versions where id = p_child.version_id);
  v_saidas jsonb;
  v_data jsonb;
begin
  select * into v_wait from public.process_waits
  where resolved_at is null and kind = 'subprocesso'
    and (child_instance_id = p_child.id or data -> 'filhas' ? p_child.id::text)
  for update;
  if v_wait.id is null then
    return;
  end if;
  -- Só as saídas da assinatura (sem assinatura, todas as variáveis)
  v_saidas := case when jsonb_typeof(v_sig -> 'saidas') = 'array'
    then (select coalesce(jsonb_object_agg(s ->> 'nome', p_child.vars -> (s ->> 'nome')), '{}')
          from jsonb_array_elements(v_sig -> 'saidas') s)
    else p_child.vars end;
  if p_child.status <> 'concluida' then
    -- Filha que falhou: a mãe segue pelo caminho de erro (ou falha)
    update public.process_waits set resolved_at = now() where id = v_wait.id;
    update public.process_tokens set status = 'pronto', result = jsonb_build_object('erro', true, 'mensagem', p_child.error), updated_at = now()
    where id = v_wait.token_id;
    perform public._automation_kick();
    return;
  end if;
  if v_wait.child_instance_id = p_child.id then
    update public.process_waits set resolved_at = now() where id = v_wait.id;
    update public.process_tokens set status = 'pronto', result = jsonb_build_object('saidas', v_saidas), updated_at = now()
    where id = v_wait.token_id;
  else
    -- Multi-instância: junta as saídas; quando todas acabam, a mãe segue com a lista
    v_data := jsonb_set(v_wait.data, '{saidas}', coalesce(v_wait.data -> 'saidas', '[]') || jsonb_build_array(v_saidas));
    v_data := jsonb_set(v_data, '{feitas}', to_jsonb(coalesce((v_wait.data ->> 'feitas')::integer, 0) + 1));
    if (v_data ->> 'feitas')::integer >= (v_data ->> 'total')::integer then
      update public.process_waits set resolved_at = now(), data = v_data where id = v_wait.id;
      update public.process_tokens set status = 'pronto', result = jsonb_build_object('saidas', v_data -> 'saidas'), updated_at = now()
      where id = v_wait.token_id;
    else
      update public.process_waits set data = v_data where id = v_wait.id;
      -- Em sequência: começa a próxima
      if (v_data ->> 'sequencial')::boolean is true then
        perform public._process_start_child(v_wait, (v_data ->> 'feitas')::integer);
      end if;
    end if;
  end if;
  perform public._automation_kick();
end;
$$;

-- Começa a filha número `p_i` de uma multi-instância (ou a única de um subprocesso)
create function public._process_start_child(p_wait public.process_waits, p_i integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inst public.process_instances;
  v_child uuid;
  v_vars jsonb := coalesce(p_wait.data -> 'entradas', '{}');
begin
  select * into v_inst from public.process_instances where id = p_wait.instance_id;
  if jsonb_typeof(p_wait.data -> 'itens') = 'array' then
    v_vars := v_vars || jsonb_build_object('item', p_wait.data -> 'itens' -> p_i, 'indice', p_i);
  end if;
  v_child := public._process_start((p_wait.data ->> 'funcao')::uuid, v_inst.owner_id, v_vars,
    jsonb_build_object('tipo', 'subprocesso', 'mae', v_inst.id), v_inst.start_data, v_inst.page_id,
    v_inst.id, p_wait.token_id, v_inst.depth + 1);
  if jsonb_typeof(p_wait.data -> 'itens') = 'array' then
    update public.process_waits set data = jsonb_set(data, '{filhas}', coalesce(data -> 'filhas', '[]') || to_jsonb(v_child::text))
    where id = p_wait.id;
  else
    update public.process_waits set child_instance_id = v_child where id = p_wait.id;
  end if;
  return v_child;
end;
$$;

-- Fecha a instância (concluída ou falhou) e avisa a mãe, se houver
create function public._process_finish(p_instance uuid, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.process_instances;
begin
  perform public._process_close(p_instance, p_status, p_error);
  select * into v from public.process_instances where id = p_instance;
  update public.process_definitions
  set fail_streak = case when p_status = 'falhou' then fail_streak + 1 else 0 end,
      -- 5 instâncias seguidas falhando: a definição desliga (PR4)
      active = case when p_status = 'falhou' and fail_streak + 1 >= 5 then false else active end
  where id = v.definition_id;
  if v.parent_instance_id is not null then
    perform public._process_child_done(v);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Avançar: tudo do passo numa transação; 'ignorado' quando a reivindicação não é a vigente
-- ---------------------------------------------------------------------------------------------
create function public.process_advance(p_token uuid, p_claim timestamptz, p_decision jsonb)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.process_tokens;
  v_inst public.process_instances;
  v_graph jsonb;
  v_node jsonb;
  v_tipo text := p_decision ->> 'tipo';
  v_vars jsonb;
  v_result jsonb;
  v_espera jsonb;
  v_wait public.process_waits;
  v_task uuid;
  v_n integer;
  v_erro text;
  v_page uuid;
begin
  select * into v_token from public.process_tokens where id = p_token for update;
  if v_token.id is null or v_token.status <> 'rodando' or v_token.claimed_at is distinct from p_claim then
    return 'ignorado';
  end if;
  select * into v_inst from public.process_instances where id = v_token.instance_id for update;
  if v_inst.status <> 'em_andamento' then
    update public.process_tokens set status = 'cancelado', updated_at = now() where id = p_token;
    return 'ignorado';
  end if;
  v_graph := (select graph from public.process_versions where id = v_inst.version_id);
  select n into v_node from jsonb_array_elements(v_graph -> 'nos') n where n ->> 'id' = v_token.node_id;

  -- Limites (PR4)
  if v_inst.steps_count + 1 > 2000 then
    perform public._process_finish(v_inst.id, 'falhou', 'Passou de 2.000 passos');
    return 'ok';
  end if;
  if v_inst.started_at < now() - interval '365 days' then
    perform public._process_finish(v_inst.id, 'falhou', 'Passou de 365 dias');
    return 'ok';
  end if;
  v_vars := v_inst.vars || coalesce(p_decision -> 'vars', '{}');
  if pg_column_size(v_vars) > 32768 then
    v_tipo := 'falha';
    p_decision := jsonb_build_object('tipo', 'falha', 'erro', 'As variáveis passaram de 32 KB');
    v_vars := v_inst.vars;
  end if;
  update public.process_instances set vars = v_vars, steps_count = steps_count + 1, updated_at = now()
  where id = v_inst.id returning * into v_inst;

  -- Efeito interno da tarefa de serviço (o externo o executor já fez e manda o resultado)
  if v_tipo = 'seguir' and p_decision ? 'efeito' then
    begin
      v_result := public._process_effect(v_inst, p_decision -> 'efeito');
    exception when others then
      v_tipo := 'falha';
      p_decision := jsonb_build_object('tipo', 'falha', 'erro', left(sqlerrm, 300));
    end;
  end if;
  v_result := coalesce(v_result, p_decision -> 'resultado');

  case v_tipo
    when 'seguir' then
      insert into public.process_steps (instance_id, token_id, node_id, node_type, status, attempt, result, finished_at)
      values (v_inst.id, p_token, v_token.node_id, coalesce(v_node ->> 'tipo', '?'), 'ok', v_token.retries + 1, v_result, now());
      update public.process_tokens set status = 'concluido', result = null, updated_at = now() where id = p_token;
      perform public._process_spawn(v_inst.id, p_decision -> 'proximos');
      update public.process_instances set fail_streak = 0 where id = v_inst.id;

    when 'juntar' then
      -- Paralelo: este token espera na junção; quando chegam todos, segue um só
      update public.process_tokens set status = 'esperando', updated_at = now() where id = p_token;
      select count(*) into v_n from public.process_tokens
      where instance_id = v_inst.id and node_id = v_token.node_id and status = 'esperando'
        and not exists (select 1 from public.process_waits w where w.token_id = process_tokens.id and w.resolved_at is null);
      if v_n >= (p_decision ->> 'esperados')::integer then
        update public.process_tokens set status = 'concluido', updated_at = now()
        where instance_id = v_inst.id and node_id = v_token.node_id and status = 'esperando'
          and not exists (select 1 from public.process_waits w where w.token_id = process_tokens.id and w.resolved_at is null);
        insert into public.process_steps (instance_id, token_id, node_id, node_type, status, result, finished_at)
        values (v_inst.id, p_token, v_token.node_id, 'and', 'ok', jsonb_build_object('juntou', v_n), now());
        perform public._process_spawn(v_inst.id, p_decision -> 'seguir');
      end if;

    when 'esperar' then
      v_espera := p_decision -> 'espera';
      update public.process_tokens set status = 'esperando', updated_at = now() where id = p_token;
      if v_espera ->> 'tipo' = 'humana' then
        v_task := public._process_human_task(v_inst, v_token, v_node, v_espera);
      end if;
      insert into public.process_waits (instance_id, token_id, kind, correlation_key, due_at, remind_at, task_id, data)
      values (v_inst.id, p_token,
              case v_espera ->> 'tipo' when 'multi' then 'subprocesso' else v_espera ->> 'tipo' end,
              v_espera ->> 'chave',
              case when v_espera ->> 'ate' ~ '^\d{4}-' then (v_espera ->> 'ate')::timestamptz end,
              case when v_espera ->> 'lembrete' ~ '^\d{4}-' then (v_espera ->> 'lembrete')::timestamptz end,
              v_task,
              case v_espera ->> 'tipo'
                when 'subprocesso' then jsonb_build_object('funcao', v_espera ->> 'funcao', 'entradas', v_espera -> 'entradas')
                when 'multi' then jsonb_build_object('funcao', v_espera ->> 'funcao', 'entradas', v_espera -> 'entradas',
                  'itens', v_espera -> 'itens', 'total', jsonb_array_length(coalesce(v_espera -> 'itens', '[]')),
                  'feitas', 0, 'sequencial', coalesce((v_espera ->> 'sequencial')::boolean, false))
                when 'humana' then jsonb_build_object('escalar', v_espera -> 'escalar', 'formulario', v_espera -> 'formulario',
                  'escolhas', v_espera -> 'escolhas', 'xp', v_espera -> 'xp', 'pessoa', v_espera -> 'pessoa',
                  'grupo', v_espera -> 'grupo')
                else '{}' end)
      returning * into v_wait;
      insert into public.process_steps (instance_id, token_id, node_id, node_type, status, assignee, due_at, result)
      values (v_inst.id, p_token, v_token.node_id, coalesce(v_node ->> 'tipo', '?'), 'esperando',
              case when v_espera ->> 'pessoa' ~ '^[0-9a-f-]{36}$' then (v_espera ->> 'pessoa')::uuid
                   when v_espera ->> 'tipo' = 'humana' then v_inst.owner_id end,
              v_wait.due_at, jsonb_strip_nulls(jsonb_build_object('tarefa', v_task, 'chave', v_espera ->> 'chave')));
      if v_espera ->> 'tipo' = 'subprocesso' then
        perform public._process_start_child(v_wait, 0);
      elsif v_espera ->> 'tipo' = 'multi' then
        if jsonb_array_length(coalesce(v_espera -> 'itens', '[]')) = 0 then
          update public.process_waits set resolved_at = now() where id = v_wait.id;
          update public.process_tokens set status = 'pronto', result = '{"saidas": []}' where id = p_token;
        elsif (v_espera ->> 'sequencial')::boolean is true then
          perform public._process_start_child(v_wait, 0);
        else
          for v_n in 0 .. jsonb_array_length(v_espera -> 'itens') - 1 loop
            perform public._process_start_child((select w from public.process_waits w where w.id = v_wait.id), v_n);
          end loop;
        end if;
      end if;

    when 'fim' then
      insert into public.process_steps (instance_id, token_id, node_id, node_type, status, error, finished_at)
      values (v_inst.id, p_token, v_token.node_id, 'fim', case when p_decision ? 'erro' then 'falhou' else 'ok' end,
              p_decision ->> 'erro', now());
      update public.process_tokens set status = 'concluido', updated_at = now() where id = p_token;
      if p_decision ? 'erro' then
        perform public._process_finish(v_inst.id, 'falhou', p_decision ->> 'erro');
      elsif not exists (select 1 from public.process_tokens where instance_id = v_inst.id
                        and status in ('pronto', 'rodando', 'esperando', 'falhou')) then
        perform public._process_finish(v_inst.id, 'concluida', null);
      end if;

    when 'falha' then
      v_erro := coalesce(p_decision ->> 'erro', 'Falhou');
      -- Erro passageiro: de novo em 1, 5 e 30 min (até 3)
      if (p_decision ->> 'tentar')::boolean is true and v_token.retries < 3 then
        update public.process_tokens set status = 'pronto', claimed_at = null, retries = retries + 1,
          resume_at = now() + (array[interval '1 minute', interval '5 minutes', interval '30 minutes'])[v_token.retries + 1],
          updated_at = now()
        where id = p_token;
        insert into public.process_steps (instance_id, token_id, node_id, node_type, status, attempt, error, finished_at)
        values (v_inst.id, p_token, v_token.node_id, coalesce(v_node ->> 'tipo', '?'), 'falhou', v_token.retries + 1, v_erro, now());
        return 'ok';
      end if;
      insert into public.process_steps (instance_id, token_id, node_id, node_type, status, attempt, error, finished_at)
      values (v_inst.id, p_token, v_token.node_id, coalesce(v_node ->> 'tipo', '?'), 'falhou', v_token.retries + 1, v_erro, now());
      if jsonb_array_length(public._process_error_path(v_graph, v_token.node_id)) > 0 then
        update public.process_tokens set status = 'concluido', updated_at = now() where id = p_token;
        update public.process_instances set vars = vars || jsonb_build_object('erro', v_erro) where id = v_inst.id;
        perform public._process_spawn(v_inst.id, public._process_error_path(v_graph, v_token.node_id));
      else
        -- Sem caminho de erro: o token fica parado para "repetir passo com falha" (process_resume)
        update public.process_tokens set status = 'falhou', updated_at = now() where id = p_token;
        update public.process_instances set status = 'falhou', error = v_erro, fail_streak = fail_streak + 1,
          finished_at = now(), updated_at = now()
        where id = v_inst.id;
        update public.process_definitions set fail_streak = fail_streak + 1,
          active = case when fail_streak + 1 >= 5 then false else active end
        where id = v_inst.definition_id;
        if v_inst.parent_instance_id is not null then
          perform public._process_child_done((select i from public.process_instances i where i.id = v_inst.id));
        end if;
      end if;
    else
      raise exception 'Decisão desconhecida: %', v_tipo using errcode = '22023';
  end case;
  return 'ok';
end;
$$;

-- Tarefa humana (PR6 completa as regras): uma tarefa normal do Questlist, ligada à instância e ao nó
create function public._process_human_task(p_inst public.process_instances, p_token public.process_tokens,
                                           p_node jsonb, p_espera jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_page uuid;
  v_id uuid := gen_random_uuid();
  v_pessoa uuid := case when p_espera ->> 'pessoa' ~ '^[0-9a-f-]{36}$' then (p_espera ->> 'pessoa')::uuid end;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  v_page := case when p_espera ->> 'lista' ~ '^[0-9a-f-]{36}$' then (p_espera ->> 'lista')::uuid
                 else (select p.id from public.pages p join public.folders f on f.id = p.folder_id
                       where p.is_inbox and f.owner_id = p_inst.owner_id limit 1) end;
  if v_page is null then
    raise exception 'Escolha a lista da tarefa' using errcode = '22023';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_inst.owner_id, 'role', 'authenticated')::text, true);
  perform public.create_tasks_batch(v_page, jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'title', left(coalesce(nullif(btrim(p_espera ->> 'titulo'), ''), 'Tarefa do processo'), 500),
    'notes', nullif(left(p_espera ->> 'descricao', 10000), ''),
    'due_date', case when p_espera ->> 'ate' ~ '^\d{4}-' then left(p_espera ->> 'ate', 10) end,
    'meta', jsonb_build_object('processo', jsonb_build_object(
      'instancia', p_inst.id, 'no', p_token.node_id, 'nome', (select name from public.process_definitions where id = p_inst.definition_id),
      'xp', coalesce((p_espera ->> 'xp')::boolean, false),
      'escolhas', coalesce(p_espera -> 'escolhas', '[]'), 'formulario', coalesce(p_espera -> 'formulario', '[]')))))));
  if v_pessoa is not null and v_pessoa <> p_inst.owner_id then
    insert into public.task_assignees (task_id, user_id) values (v_id, v_pessoa) on conflict do nothing;
  end if;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- O fim das esperas
-- ---------------------------------------------------------------------------------------------
create function public._process_resolve_wait(p_wait uuid, p_result jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_token uuid;
begin
  update public.process_waits set resolved_at = now() where id = p_wait and resolved_at is null returning token_id into v_token;
  if v_token is null then
    return;
  end if;
  update public.process_tokens set status = 'pronto', result = coalesce(p_result, '{}'), claimed_at = null, updated_at = now()
  where id = v_token and status = 'esperando';
  perform public._automation_kick();
end;
$$;

-- Mensagem: o sinal com a chave chega às instâncias da pessoa que esperam por ela
create function public.process_signal(p_key text, p_payload jsonb default '{}')
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait uuid;
  v_n integer := 0;
begin
  for v_wait in
    select w.id from public.process_waits w join public.process_instances i on i.id = w.instance_id
    where w.kind = 'mensagem' and w.resolved_at is null and w.correlation_key = p_key and i.owner_id = auth.uid()
  loop
    perform public._process_resolve_wait(v_wait, jsonb_build_object('mensagem', coalesce(p_payload, '{}')));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Tarefa humana concluída: o processo segue (com a escolha e o formulário, se a RPC do PR6 gravou)
create function public.process_task_done()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits;
begin
  if new.status <> 'done' or old.status = 'done' then
    return null;
  end if;
  select * into v_wait from public.process_waits where task_id = new.id and resolved_at is null and kind = 'humana';
  if v_wait.id is null then
    return null;
  end if;
  perform public._process_resolve_wait(v_wait.id, coalesce(v_wait.data -> 'resposta', '{}') || jsonb_build_object('concluida_por', auth.uid()));
  return null;
end;
$$;
create trigger process_task_done after update of status on public.tasks
  for each row when (new.status = 'done' and old.status is distinct from 'done')
  execute function public.process_task_done();

-- Varredor: temporizadores, prazos de mensagem e lembretes, todos pelo índice de vencimento
create function public._process_sweep()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait public.process_waits;
  v_n integer := 0;
begin
  for v_wait in
    select * from public.process_waits
    where resolved_at is null and due_at is not null and due_at <= now()
    order by due_at
    for update skip locked
    limit 500
  loop
    if v_wait.kind = 'temporizador' then
      perform public._process_resolve_wait(v_wait.id, '{}');
    elsif v_wait.kind = 'mensagem' then
      perform public._process_resolve_wait(v_wait.id, '{"prazo": true}');
    elsif v_wait.kind = 'humana' then
      perform public._process_escalate(v_wait);
    end if;
    v_n := v_n + 1;
  end loop;
  -- Lembrete antes do prazo da tarefa humana (uma vez)
  for v_wait in
    select * from public.process_waits
    where resolved_at is null and reminded_at is null and remind_at is not null and remind_at <= now()
    for update skip locked
    limit 500
  loop
    update public.process_waits set reminded_at = now() where id = v_wait.id;
    insert into public.notifications (user_id, kind, payload)
    select coalesce((v_wait.data ->> 'pessoa')::uuid, i.owner_id), 'automation', jsonb_build_object(
      'titulo', 'Lembrete do processo', 'message', 'O prazo desta tarefa está chegando', 'task_id', v_wait.task_id,
      'title', (select title from public.tasks where id = v_wait.task_id), 'processo', i.id)
    from public.process_instances i where i.id = v_wait.instance_id;
  end loop;
  return v_n;
end;
$$;

-- Prazo vencido de uma tarefa humana (PR6): segue pelo caminho de prazo, reatribui ou avisa
create function public._process_escalate(p_wait public.process_waits)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_inst public.process_instances;
  v_escalar jsonb := p_wait.data -> 'escalar';
  v_tipo text := coalesce(p_wait.data #>> '{escalar,tipo}', 'caminho');
  v_pessoa uuid := case when p_wait.data #>> '{escalar,pessoa}' ~ '^[0-9a-f-]{36}$' then (p_wait.data #>> '{escalar,pessoa}')::uuid end;
begin
  select * into v_inst from public.process_instances where id = p_wait.instance_id;
  if v_tipo = 'caminho' then
    perform public._process_resolve_wait(p_wait.id, '{"prazo": true}');
    return;
  end if;
  -- Reatribuir ou avisar: a tarefa continua aberta, sem novo prazo
  update public.process_waits set due_at = null where id = p_wait.id;
  if v_tipo = 'reatribuir' and v_pessoa is not null and p_wait.task_id is not null then
    delete from public.task_assignees where task_id = p_wait.task_id;
    insert into public.task_assignees (task_id, user_id) values (p_wait.task_id, v_pessoa) on conflict do nothing;
    insert into public.process_steps (instance_id, token_id, node_id, node_type, status, assignee, result, finished_at)
    values (v_inst.id, p_wait.token_id, (select node_id from public.process_tokens where id = p_wait.token_id), 'humana',
            'esperando', v_pessoa, jsonb_build_object('escalou', 'reatribuir', 'tarefa', p_wait.task_id), now());
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (coalesce(v_pessoa, v_inst.owner_id), 'automation', jsonb_build_object(
    'titulo', 'Prazo vencido no processo', 'message', 'Uma tarefa do processo passou do prazo',
    'task_id', p_wait.task_id, 'title', (select title from public.tasks where id = p_wait.task_id), 'processo', v_inst.id));
end;
$$;

-- O varredor das automações passa a cuidar dos processos também
create or replace function public._automation_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_schedule();
  perform public._automation_scan_due();
  perform public._process_sweep();
  if exists (select 1 from public.automation_events where processed_at is null and available_at <= now())
     or exists (select 1 from public.automation_runs
                where status = 'pendente'
                   or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
                   or (status = 'esperando' and resume_at <= now()))
     or exists (select 1 from public.process_tokens
                where (status = 'pronto' and (resume_at is null or resume_at <= now()))
                   or (status = 'rodando' and claimed_at < now() - interval '2 minutes')) then
    perform public._automation_kick();
  end if;
end;
$$;

-- Instância parada (sem token vivo nem espera): falha com o motivo, na limpeza da madrugada
select cron.schedule('processos-parados', '53 4 * * *', $$
  update public.process_instances i set status = 'falhou', error = 'Parou sem ter para onde ir', finished_at = now()
  where i.status = 'em_andamento' and i.updated_at < now() - interval '1 hour'
    and not exists (select 1 from public.process_tokens t where t.instance_id = i.id
                    and t.status in ('pronto', 'rodando', 'esperando'));
$$);

-- Repetir o passo com falha: o token parado volta a ficar pronto
create or replace function public.process_resume(p_instance uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.process_instances := public._process_own_instance(p_instance);
begin
  update public.process_instances set status = 'em_andamento', fail_streak = 0, error = null, finished_at = null, updated_at = now()
  where id = v.id and status in ('suspensa', 'falhou');
  update public.process_tokens set status = 'pronto', claimed_at = null, retries = 0, updated_at = now()
  where instance_id = v.id and status in ('rodando', 'falhou');
  perform public._automation_kick();
end;
$$;

revoke execute on function public.process_claim(integer), public._process_effect(public.process_instances, jsonb),
  public._process_spawn(uuid, jsonb), public._process_error_path(jsonb, text),
  public._process_child_done(public.process_instances), public._process_start_child(public.process_waits, integer),
  public._process_finish(uuid, text, text), public.process_advance(uuid, timestamptz, jsonb),
  public._process_human_task(public.process_instances, public.process_tokens, jsonb, jsonb),
  public._process_resolve_wait(uuid, jsonb), public.process_task_done(), public._process_sweep(),
  public._process_escalate(public.process_waits), public._automation_sweep()
  from public, anon, authenticated;
grant execute on function public.process_claim(integer), public.process_advance(uuid, timestamptz, jsonb) to service_role;
revoke execute on function public.process_signal(text, jsonb) from public, anon;
grant execute on function public.process_signal(text, jsonb) to authenticated;
