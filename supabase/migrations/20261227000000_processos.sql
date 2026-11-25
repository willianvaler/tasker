-- Processos, o BPM leve (ESCOPO_V16 Parte B, PR1, D349): definições versionadas, instâncias presas à
-- versão em que nasceram, tokens (para o paralelo), passos (histórico, só inserção) e esperas.
-- O cliente escreve só a definição (nome, descrição, rascunho); publicar, iniciar, cancelar,
-- suspender e retomar são RPCs; tokens, passos e esperas são do servidor. Processos são de uso
-- próprio (V16-16). Quem roda é o executor das automações (Edge Function `automation-run`, PR4).

-- ---------------------------------------------------------------------------------------------
-- Definições e versões
-- ---------------------------------------------------------------------------------------------
create table public.process_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  -- Rascunho do grafo (o editor grava aqui; publicar copia para uma versão nova)
  draft jsonb not null default '{"v": 1, "nos": [], "arestas": []}' check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 262144),
  active boolean not null default true,
  -- Função (FN): chamável por outro processo, com assinatura
  is_function boolean not null default false,
  -- Iniciar por página (PR7): o gatilho do início, copiado da versão publicada
  start_trigger text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index process_definitions_owner on public.process_definitions (owner_id);
alter table public.process_definitions enable row level security;
create policy "process_definitions_own" on public.process_definitions for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update on public.process_definitions from anon, authenticated;
grant insert (id, name, description, draft, active, is_function), update (name, description, draft, active, is_function)
  on public.process_definitions to authenticated;

create table public.process_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.process_definitions (id) on delete cascade,
  number integer not null,
  graph jsonb not null,
  -- Função: entradas e saídas (para avisar de quebra de contrato ao publicar, FN)
  signature jsonb,
  author uuid default auth.uid() references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (definition_id, number)
);
alter table public.process_versions enable row level security;
revoke all on public.process_versions from anon, authenticated;
grant select on public.process_versions to authenticated;
create policy "process_versions_own" on public.process_versions for select to authenticated
  using (exists (select 1 from public.process_definitions d where d.id = definition_id and d.owner_id = auth.uid()));

-- Versão publicada não muda (nem pelo servidor)
create function public.process_versions_immutable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Versão publicada não muda: publique uma nova' using errcode = '42501';
end;
$$;
create trigger process_versions_immutable before update on public.process_versions
  for each row execute function public.process_versions_immutable();

-- ---------------------------------------------------------------------------------------------
-- Instâncias, tokens, passos e esperas
-- ---------------------------------------------------------------------------------------------
create table public.process_instances (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.process_definitions (id) on delete cascade,
  version_id uuid not null references public.process_versions (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluida', 'cancelada', 'falhou', 'suspensa')),
  started_by uuid references public.profiles (id) on delete set null,
  -- De onde veio: manual, regra, página, webhook, horário, subprocesso
  origin jsonb not null default '{}',
  vars jsonb not null default '{}' check (jsonb_typeof(vars) = 'object' and pg_column_size(vars) <= 32768),
  -- `inicio.*` (o gatilho) e `pagina.*` (a página que originou, PR7)
  start_data jsonb not null default '{}',
  page_id uuid,
  steps_count integer not null default 0,
  depth integer not null default 0 check (depth between 0 and 5),
  parent_instance_id uuid references public.process_instances (id) on delete cascade,
  parent_token_id uuid,
  fail_streak integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index process_instances_owner on public.process_instances (owner_id, status);
create index process_instances_definition on public.process_instances (definition_id, started_at desc);
create index process_instances_page on public.process_instances (page_id) where page_id is not null;
alter table public.process_instances enable row level security;
revoke all on public.process_instances from anon, authenticated;
grant select on public.process_instances to authenticated;

create table public.process_tokens (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.process_instances (id) on delete cascade,
  node_id text not null,
  status text not null default 'pronto' check (status in ('pronto', 'rodando', 'esperando', 'concluido', 'cancelado')),
  scope jsonb not null default '{}',
  -- O retorno da espera (tarefa concluída, mensagem, subprocesso) para o próximo passo
  result jsonb,
  claimed_at timestamptz,
  attempts integer not null default 0,
  retries integer not null default 0,
  resume_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index process_tokens_ready on public.process_tokens (created_at) where status = 'pronto';
create index process_tokens_running on public.process_tokens (claimed_at) where status = 'rodando';
create index process_tokens_instance on public.process_tokens (instance_id, status);
alter table public.process_tokens enable row level security;
revoke all on public.process_tokens from anon, authenticated;
grant select on public.process_tokens to authenticated;

create table public.process_steps (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.process_instances (id) on delete cascade,
  token_id uuid,
  node_id text not null,
  node_type text not null,
  status text not null check (status in ('ok', 'esperando', 'falhou', 'cancelado', 'simulado')),
  attempt integer not null default 1,
  assignee uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  result jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index process_steps_instance on public.process_steps (instance_id, started_at);
create index process_steps_assignee on public.process_steps (assignee) where assignee is not null;
alter table public.process_steps enable row level security;
revoke all on public.process_steps from anon, authenticated;
grant select on public.process_steps to authenticated;

-- Histórico só cresce (o fim da espera grava uma linha nova, não muda a antiga)
create function public.process_steps_append_only()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'O histórico do processo só recebe linhas novas' using errcode = '42501';
end;
$$;
create trigger process_steps_append_only before update on public.process_steps
  for each row execute function public.process_steps_append_only();

create table public.process_waits (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.process_instances (id) on delete cascade,
  token_id uuid not null references public.process_tokens (id) on delete cascade,
  kind text not null check (kind in ('mensagem', 'temporizador', 'humana', 'subprocesso')),
  correlation_key text,
  due_at timestamptz,
  remind_at timestamptz,
  reminded_at timestamptz,
  task_id uuid,
  child_instance_id uuid,
  data jsonb not null default '{}',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index process_waits_due on public.process_waits (due_at) where resolved_at is null and due_at is not null;
create index process_waits_remind on public.process_waits (remind_at) where resolved_at is null and reminded_at is null and remind_at is not null;
create index process_waits_key on public.process_waits (correlation_key) where resolved_at is null and kind = 'mensagem';
create index process_waits_task on public.process_waits (task_id) where resolved_at is null and task_id is not null;
create index process_waits_child on public.process_waits (child_instance_id) where resolved_at is null;
alter table public.process_waits enable row level security;
revoke all on public.process_waits from anon, authenticated;
grant select on public.process_waits to authenticated;

-- Quem vê: a dona da definição; o responsável de uma tarefa humana vê a instância e o passo dele
create function public.can_see_process_instance(p_instance uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.process_instances i where i.id = p_instance and i.owner_id = auth.uid())
      or exists (select 1 from public.process_steps s where s.instance_id = p_instance and s.assignee = auth.uid());
$$;
create policy "process_instances_select" on public.process_instances for select to authenticated
  using (owner_id = auth.uid() or public.can_see_process_instance(id));
create policy "process_tokens_select" on public.process_tokens for select to authenticated
  using (exists (select 1 from public.process_instances i where i.id = instance_id and i.owner_id = auth.uid()));
create policy "process_steps_select" on public.process_steps for select to authenticated
  using (assignee = auth.uid()
         or exists (select 1 from public.process_instances i where i.id = instance_id and i.owner_id = auth.uid()));
create policy "process_waits_select" on public.process_waits for select to authenticated
  using (exists (select 1 from public.process_instances i where i.id = instance_id and i.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Validação no banco (o essencial; a completa é a do módulo compartilhado, que o editor e o
-- executor também rodam): forma, tamanho, tipos, um início, um fim, ligações, alcance e XOR
-- ---------------------------------------------------------------------------------------------
create function public._process_fail(p_message text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = '22023';
end;
$$;

create function public.process_validate(p_graph jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_nos jsonb := p_graph -> 'nos';
  v_arestas jsonb := coalesce(p_graph -> 'arestas', '[]');
  v_inicio text;
  v_ruim text;
begin
  if jsonb_typeof(p_graph) <> 'object' or (p_graph ->> 'v') is distinct from '1'
     or jsonb_typeof(v_nos) <> 'array' or jsonb_typeof(v_arestas) <> 'array' then
    perform public._process_fail('Processo em formato desconhecido');
  end if;
  if jsonb_array_length(v_nos) > 200 then
    perform public._process_fail('No máximo 200 nós por processo');
  end if;
  if (select count(distinct n ->> 'id') from jsonb_array_elements(v_nos) n) <> jsonb_array_length(v_nos) then
    perform public._process_fail('Dois nós com o mesmo id');
  end if;
  select n ->> 'id' into v_ruim from jsonb_array_elements(v_nos) n
  where coalesce(n ->> 'tipo', '') not in ('inicio', 'fim', 'servico', 'humana', 'xor', 'and', 'temporizador',
                                           'mensagem', 'subprocesso', 'laco', 'multi') limit 1;
  if v_ruim is not null then
    perform public._process_fail('Nó de tipo desconhecido: ' || v_ruim);
  end if;
  if (select count(*) from jsonb_array_elements(v_nos) n where n ->> 'tipo' = 'inicio') <> 1 then
    perform public._process_fail('O processo precisa de um início, e só um');
  end if;
  if not exists (select 1 from jsonb_array_elements(v_nos) n where n ->> 'tipo' = 'fim') then
    perform public._process_fail('O processo precisa de um fim');
  end if;
  select a ->> 'id' into v_ruim from jsonb_array_elements(v_arestas) a
  where not exists (select 1 from jsonb_array_elements(v_nos) n where n ->> 'id' = a ->> 'de')
     or not exists (select 1 from jsonb_array_elements(v_nos) n where n ->> 'id' = a ->> 'para') limit 1;
  if v_ruim is not null then
    perform public._process_fail('Ligação para um nó que não existe: ' || v_ruim);
  end if;
  select n ->> 'id' into v_inicio from jsonb_array_elements(v_nos) n where n ->> 'tipo' = 'inicio';
  -- Todo nó alcançável do início
  with recursive alc(id) as (
    select v_inicio
    union
    select a ->> 'para' from alc join jsonb_array_elements(v_arestas) a on a ->> 'de' = alc.id
  )
  select coalesce(n ->> 'nome', n ->> 'id') into v_ruim from jsonb_array_elements(v_nos) n
  where not exists (select 1 from alc where alc.id = n ->> 'id') limit 1;
  if v_ruim is not null then
    perform public._process_fail('Nó que nunca é alcançado: ' || v_ruim);
  end if;
  -- E todo nó chega a um fim (laço sem saída não chega)
  with recursive volta(id) as (
    select n ->> 'id' from jsonb_array_elements(v_nos) n where n ->> 'tipo' = 'fim'
    union
    select a ->> 'de' from volta join jsonb_array_elements(v_arestas) a on a ->> 'para' = volta.id
  )
  select coalesce(n ->> 'nome', n ->> 'id') into v_ruim from jsonb_array_elements(v_nos) n
  where not exists (select 1 from volta where volta.id = n ->> 'id') limit 1;
  if v_ruim is not null then
    perform public._process_fail('Nó sem caminho até um fim: ' || v_ruim);
  end if;
  -- XOR: dois caminhos ou mais, e um padrão só
  select coalesce(n ->> 'nome', n ->> 'id') into v_ruim from jsonb_array_elements(v_nos) n
  where n ->> 'tipo' = 'xor'
    and ((select count(*) from jsonb_array_elements(v_arestas) a where a ->> 'de' = n ->> 'id') < 2
         or (select count(*) from jsonb_array_elements(v_arestas) a
             where a ->> 'de' = n ->> 'id' and (a ->> 'padrao')::boolean is true) <> 1)
  limit 1;
  if v_ruim is not null then
    perform public._process_fail('Portão de decisão sem caminho padrão: ' || v_ruim);
  end if;
end;
$$;

-- Publicar: valida o rascunho e grava a versão seguinte (as instâncias antigas ficam na delas)
create function public.process_publish(p_definition uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_def public.process_definitions;
  v_id uuid;
begin
  select * into v_def from public.process_definitions where id = p_definition and owner_id = auth.uid();
  if v_def.id is null then
    raise exception 'Processo não encontrado' using errcode = '42501';
  end if;
  perform public.process_validate(v_def.draft);
  insert into public.process_versions (definition_id, number, graph, signature)
  values (v_def.id,
          coalesce((select max(number) from public.process_versions where definition_id = v_def.id), 0) + 1,
          v_def.draft, v_def.draft -> 'assinatura')
  returning id into v_id;
  update public.process_definitions set
    start_trigger = (select n #>> '{gatilho,tipo}' from jsonb_array_elements(v_def.draft -> 'nos') n where n ->> 'tipo' = 'inicio'),
    updated_at = now()
  where id = v_def.id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Iniciar, cancelar, suspender, retomar
-- ---------------------------------------------------------------------------------------------
create function public._process_start(p_definition uuid, p_owner uuid, p_vars jsonb, p_origin jsonb,
                                      p_start jsonb, p_page uuid, p_parent uuid, p_parent_token uuid, p_depth integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_version public.process_versions;
  v_id uuid;
  v_inicio text;
begin
  select v.* into v_version from public.process_versions v
  where v.definition_id = p_definition order by v.number desc limit 1;
  if v_version.id is null then
    raise exception 'Este processo ainda não foi publicado' using errcode = '22023';
  end if;
  if p_depth > 5 then
    raise exception 'No máximo 5 processos um dentro do outro' using errcode = '22023';
  end if;
  if (select count(*) from public.process_instances where owner_id = p_owner and status in ('em_andamento', 'suspensa')) >= 500 then
    raise exception 'No máximo 500 processos em andamento por pessoa' using errcode = '22023';
  end if;
  if p_parent is null and (select count(*) from public.process_instances
      where definition_id = p_definition and started_at > now() - interval '1 hour') >= 60 then
    raise exception 'No máximo 60 inícios por hora deste processo' using errcode = '22023';
  end if;
  select n ->> 'id' into v_inicio from jsonb_array_elements(v_version.graph -> 'nos') n where n ->> 'tipo' = 'inicio';
  insert into public.process_instances (definition_id, version_id, owner_id, started_by, origin, vars, start_data,
                                        page_id, parent_instance_id, parent_token_id, depth)
  values (p_definition, v_version.id, p_owner, auth.uid(), coalesce(p_origin, '{}'), coalesce(p_vars, '{}'),
          coalesce(p_start, '{}'), p_page, p_parent, p_parent_token, p_depth)
  returning id into v_id;
  insert into public.process_tokens (instance_id, node_id) values (v_id, v_inicio);
  perform public._automation_kick();
  return v_id;
end;
$$;

create function public.process_start(p_definition uuid, p_vars jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.process_definitions where id = p_definition and owner_id = auth.uid() and active) then
    raise exception 'Processo não encontrado ou desligado' using errcode = '42501';
  end if;
  return public._process_start(p_definition, auth.uid(), p_vars, jsonb_build_object('tipo', 'manual'), '{}', null, null, null, 0);
end;
$$;

create function public._process_own_instance(p_instance uuid)
returns public.process_instances
language plpgsql stable security definer set search_path = ''
as $$
declare
  v public.process_instances;
begin
  select * into v from public.process_instances where id = p_instance and owner_id = auth.uid();
  if v.id is null then
    raise exception 'Processo não encontrado' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- Cancelar não desfaz o que já aconteceu (sem compensação, §10): só encerra tokens, esperas e tarefas
create function public.process_cancel(p_instance uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.process_instances := public._process_own_instance(p_instance);
begin
  perform public._process_close(v.id, 'cancelada', null);
end;
$$;

create function public._process_close(p_instance uuid, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.process_tokens set status = 'cancelado', updated_at = now()
  where instance_id = p_instance and status in ('pronto', 'rodando', 'esperando');
  update public.process_waits set resolved_at = now() where instance_id = p_instance and resolved_at is null;
  update public.process_instances set status = p_status, error = coalesce(p_error, error), finished_at = now(), updated_at = now()
  where id = p_instance and status in ('em_andamento', 'suspensa');
  -- Filhas (subprocessos) acompanham
  perform public._process_close(c.id, p_status, 'O processo de cima foi encerrado')
  from public.process_instances c where c.parent_instance_id = p_instance and c.status in ('em_andamento', 'suspensa');
end;
$$;

create function public.process_suspend(p_instance uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.process_instances := public._process_own_instance(p_instance);
begin
  update public.process_instances set status = 'suspensa', updated_at = now() where id = v.id and status = 'em_andamento';
end;
$$;

create function public.process_resume(p_instance uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.process_instances := public._process_own_instance(p_instance);
begin
  update public.process_instances set status = 'em_andamento', fail_streak = 0, updated_at = now()
  where id = v.id and status in ('suspensa', 'falhou');
  -- O passo que falhou volta a ser tentado
  update public.process_tokens set status = 'pronto', claimed_at = null, updated_at = now()
  where instance_id = v.id and status = 'rodando';
  perform public._automation_kick();
end;
$$;

revoke execute on function public.process_versions_immutable(), public.process_steps_append_only(),
  public._process_fail(text), public._process_start(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, uuid, integer),
  public._process_own_instance(uuid), public._process_close(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.can_see_process_instance(uuid) from public, anon;
grant execute on function public.can_see_process_instance(uuid) to authenticated;
revoke execute on function public.process_validate(jsonb), public.process_publish(uuid), public.process_start(uuid, jsonb),
  public.process_cancel(uuid), public.process_suspend(uuid), public.process_resume(uuid) from public, anon;
grant execute on function public.process_validate(jsonb), public.process_publish(uuid), public.process_start(uuid, jsonb),
  public.process_cancel(uuid), public.process_suspend(uuid), public.process_resume(uuid) to authenticated;
-- A exportação de dados da conta leva as automações pessoais (faltavam desde o V14) e os processos
create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    -- V10: amigos (nick e desde quando) e o link de amizade
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', f.username, 'status', f.status, 'since', f.since))
                         from public.my_friends() f), '[]'),
    -- V10 §4: o que publiquei na comunidade (com a cópia), curtidas e denúncias
    'community_posts', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
                                 from public.community_posts c where c.author_id = v_user), '[]'),
    'community_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'at', l.created_at))
                                 from public.community_likes l where l.user_id = v_user), '[]'),
    'community_reports', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id')
                                   from public.community_reports r where r.user_id = v_user), '[]'),
    -- V6: peso e medidas (dado sensível, AC7) e o consentimento dado para eles
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id' order by b.kind, b.measured_on)
                              from public.body_metrics b where b.user_id = v_user), '[]'),
    'body_goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.body_goals g
                            where g.user_id = v_user), '[]'),
    -- Bem-estar: remédios (dado de saúde, sensível, BE4)
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.created_at)
                             from public.medications m where m.user_id = v_user), '[]'),
    'sensitive_consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.granted_at)
                                    from public.sensitive_consents c where c.user_id = v_user), '[]'),
    -- V6: o diário de treino (AC4)
    'workout_sets', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.performed_at)
                              from public.workout_sets w where w.user_id = v_user), '[]'),
    -- V6: exercícios próprios
    'user_exercises', coalesce((select jsonb_agg(to_jsonb(u) - 'owner_id' order by u.created_at)
                                from public.user_exercises u where u.owner_id = v_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  ) || jsonb_build_object(
    -- V11 (OB11): anotações da pessoa e as versões delas
    'notes', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notes n
                       where n.user_id = v_user), '[]'),
    'note_versions', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id' order by v.created_at) from public.note_versions v
                               where v.user_id = v_user), '[]'),
    -- OB14: com quem compartilhei (e o que recebi) e o que publiquei (sem o hash da senha)
    'note_shares', coalesce((select jsonb_agg(jsonb_build_object('note_id', s.note_id, 'role', s.role,
                                                                  'mine', s.owner_id = v_user, 'at', s.created_at)
                                              order by s.created_at)
                             from public.note_shares s where s.owner_id = v_user or s.user_id = v_user), '[]'),
    'note_publications', coalesce((select jsonb_agg(to_jsonb(p) - 'owner_id' - 'password_hash' order by p.created_at)
                                   from public.note_publications p where p.owner_id = v_user), '[]'),
    -- V12 (AG1): a disponibilidade da agenda
    'availability_rules', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.weekday, r.starts)
                                    from public.availability_rules r where r.user_id = v_user), '[]'),
    'availability_exceptions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.starts_on)
                                         from public.availability_exceptions x where x.user_id = v_user), '[]'),
    -- AG2: tipos de compromisso e as reservas feitas comigo (com os dados de quem reservou)
    'booking_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at)
                               from public.booking_types t where t.user_id = v_user), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'owner_id' - 'token' order by b.starts_at)
                          from public.bookings b where b.owner_id = v_user), '[]'),
    'time_polls', coalesce((select jsonb_agg(to_jsonb(tp) - 'owner_id' - 'token' || jsonb_build_object(
        'slots', coalesce((select jsonb_agg(s.starts_at order by s.starts_at)
                           from public.time_poll_slots s where s.poll_id = tp.id), '[]'),
        'votes', coalesce((select jsonb_agg(jsonb_build_object('name', v.name, 'email', v.email,
                             'slots', (select coalesce(jsonb_agg(s.starts_at order by s.starts_at), '[]')
                                       from public.time_poll_slots s where s.id = any (v.slots)))
                           order by v.created_at)
                           from public.time_poll_votes v where v.poll_id = tp.id), '[]'))
        order by tp.created_at)
                            from public.time_polls tp where tp.owner_id = v_user), '[]')
  ) || jsonb_build_object(
    'automation_rules', coalesce((select jsonb_agg(to_jsonb(r) - 'owner_id' order by r.created_at)
      from public.automation_rules r where r.owner_id = v_user and r.scope = 'pessoal'), '[]'),
    'automation_runs', coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at)
      from public.automation_runs x join public.automation_rules r on r.id = x.rule_id
      where r.owner_id = v_user and r.scope = 'pessoal'), '[]'),
    'process_definitions', coalesce((select jsonb_agg(to_jsonb(d) - 'owner_id' order by d.created_at)
      from public.process_definitions d where d.owner_id = v_user), '[]'),
    'process_versions', coalesce((select jsonb_agg(to_jsonb(v) order by v.published_at)
      from public.process_versions v join public.process_definitions d on d.id = v.definition_id
      where d.owner_id = v_user), '[]'),
    'process_instances', coalesce((select jsonb_agg(to_jsonb(i) - 'owner_id' || jsonb_build_object(
        'steps', coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at) from public.process_steps s
                           where s.instance_id = i.id), '[]')) order by i.started_at)
      from public.process_instances i where i.owner_id = v_user), '[]'),
    'project_files', coalesce((select jsonb_agg(to_jsonb(pf) - 'created_by' order by pf.created_at)
                               from public.project_files pf where pf.created_by = v_user), '[]'),
    'note_images', coalesce((select jsonb_agg(to_jsonb(na) - 'user_id' order by na.created_at)
                             from public.note_assets na where na.user_id = v_user), '[]'),
    'reading_positions', coalesce((select jsonb_agg(to_jsonb(rp) - 'user_id' order by rp.updated_at)
                                   from public.reading_positions rp where rp.user_id = v_user), '[]')
  );
end;
$$;
