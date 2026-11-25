-- Motor de automações: gatilhos e condições (ESCOPO_V14 §3 e §4, AU3, D335).
--
-- Onde cada gatilho nasce (todos passam por automation_emit, que sai sem gravar quando ninguém tem
-- regra daquele tipo):
--   tarefa.criada, tarefa.concluida, tarefa.pronta, tarefa.atribuida, lista.concluida → task_events
--     (vale para pasta pessoal e projeto); a dona da regra pessoal é quem fez (na atribuída, quem
--     recebeu), e a regra de projeto é a da pasta raiz;
--   nivel.subiu → profiles.level subiu; boss.derrotado → bosses.defeated_at (cada pessoa do boss);
--   marco.atingido → milestones.done_at.
-- tarefa.atrasada/vencendo, horario e intervalo são do agendador (AU5); webhook, do AU8.
-- O create_from_template (modelos, kits, importar do Habitica/Todoist e o plano de estudos) liga
-- `questlist.bulk`: nada do que ele cria emite evento.

-- ---------------------------------------------------------------------------------------------
-- Condições prontas: parâmetros validados no banco
-- ---------------------------------------------------------------------------------------------
create or replace function public._automation_check_condition(p_node jsonb, p_level integer)
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
    case p_node ->> 'pronta'
      when 'janela_horario' then
        if coalesce(p_node ->> 'de', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           or coalesce(p_node ->> 'ate', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          perform public._automation_fail('Janela de horário: de e até em HH:MM');
        end if;
      when 'dias_semana' then
        if jsonb_typeof(p_node -> 'dias') <> 'array' or jsonb_array_length(p_node -> 'dias') = 0
           or exists (select 1 from jsonb_array_elements_text(p_node -> 'dias') d where d !~ '^[0-6]$') then
          perform public._automation_fail('Dias da semana: de 0 (domingo) a 6');
        end if;
      when 'projeto', 'lista' then
        if coalesce(p_node ->> (p_node ->> 'pronta'), '') !~ '^[0-9a-f-]{36}$' then
          perform public._automation_fail('Escolha o projeto ou a lista');
        end if;
      when 'etiqueta' then
        if char_length(btrim(coalesce(p_node ->> 'etiqueta', ''))) not between 1 and 50 then
          perform public._automation_fail('Etiqueta de 1 a 50 caracteres');
        end if;
      when 'nivel_min' then
        if coalesce(p_node ->> 'nivel', '') !~ '^[0-9]{1,4}$' then
          perform public._automation_fail('Nível mínimo: um número');
        end if;
      else
        perform public._automation_fail('Condição pronta desconhecida: ' || coalesce(p_node ->> 'pronta', ''));
    end case;
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

-- ---------------------------------------------------------------------------------------------
-- Emissão: a mesma checagem barata, separada para quem precisa montar o payload só se valer a pena
-- ---------------------------------------------------------------------------------------------
create function public._automation_wants(p_kind text, p_owner uuid, p_folder uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(current_setting('questlist.bulk', true), '') <> '1'
     and (exists (select 1 from public.automation_rules
                  where enabled and owner_id = p_owner and scope = 'pessoal' and trigger_type = p_kind)
          or exists (select 1 from public.automation_rules
                     where enabled and folder_id = p_folder and trigger_type = p_kind and trigger is null));
$$;

create or replace function public.automation_emit(
  p_kind text, p_payload jsonb default '{}', p_owner uuid default null, p_folder uuid default null,
  p_dedupe text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public._automation_wants(p_kind, p_owner, p_folder) then
    return null;
  end if;
  insert into public.automation_events (owner_id, folder_id, kind, payload, dedupe_key)
  values (p_owner, p_folder, p_kind, coalesce(p_payload, '{}'), p_dedupe)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- O que a tarefa oferece em `evento.*` (nomes em pt-BR; os apelidos em inglês e espanhol são do motor)
create function public._automation_task_payload(p_task uuid, p_actor uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'tarefa', t.id, 'titulo', t.title, 'lista', t.page_id, 'lista_nome', p.name,
    'projeto', public.folder_root(t.folder_id), 'projeto_nome', f.name,
    'etiquetas', to_jsonb(coalesce(t.labels, '{}')), 'vencimento', t.due_date, 'hora', to_char(t.due_time, 'HH24:MI'),
    'concluida_em', t.completed_at, 'por', p_actor, 'por_nome', a.display_name))
  from public.tasks t
  left join public.pages p on p.id = t.page_id
  left join public.folders f on f.id = public.folder_root(t.folder_id)
  left join public.profiles a on a.id = p_actor
  where t.id = p_task;
$$;

create function public.task_events_emit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := case new.kind when 'created' then 'tarefa.criada' when 'completed' then 'tarefa.concluida'
                               when 'ready' then 'tarefa.pronta' when 'assigned' then 'tarefa.atribuida' end;
  v_owner uuid := case when new.kind = 'assigned' then (new.payload ->> 'user_id')::uuid else new.user_id end;
  v_payload jsonb;
  v_page uuid;
begin
  if v_kind is null then
    return null;
  end if;
  if public._automation_wants(v_kind, v_owner, new.root_id) then
    v_payload := public._automation_task_payload(new.task_id, new.user_id);
    if v_payload is not null then
      if new.kind = 'assigned' then
        v_payload := v_payload || jsonb_strip_nulls(jsonb_build_object('pessoa', v_owner, 'pessoa_nome', new.payload ->> 'name'));
      end if;
      perform public.automation_emit(v_kind, v_payload, v_owner, new.root_id, 'te|' || new.id);
    end if;
  end if;
  -- Lista inteira concluída: nenhuma folha aberta (a mesma conta da D143)
  if new.kind = 'completed' and public._automation_wants('lista.concluida', new.user_id, new.root_id) then
    select page_id into v_page from public.tasks where id = new.task_id;
    if v_page is not null and not exists (
      select 1 from public.tasks t where t.page_id = v_page and t.status <> 'done'
        and not exists (select 1 from public.tasks k where k.parent_task_id = t.id)
    ) then
      perform public.automation_emit('lista.concluida',
        jsonb_strip_nulls(jsonb_build_object('lista', v_page, 'lista_nome', public._page_title(v_page),
          'projeto', new.root_id, 'projeto_nome', (select name from public.folders where id = new.root_id),
          'tarefa', new.task_id, 'titulo', new.payload ->> 'title', 'por', new.user_id)),
        new.user_id, new.root_id, 'lc|' || new.id);
    end if;
  end if;
  return null;
end;
$$;
create trigger task_events_emit after insert on public.task_events
  for each row execute function public.task_events_emit();

-- Subiu de nível (só leitura do jogo: o motor consome, não muda nada no cálculo)
create function public.profiles_level_emit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.level > old.level then
    perform public.automation_emit('nivel.subiu',
      jsonb_build_object('nivel', new.level, 'nivel_anterior', old.level), new.id, null,
      'nv|' || new.id || '|' || new.level);
  end if;
  return null;
end;
$$;
create trigger profiles_level_emit after update of level on public.profiles
  for each row execute function public.profiles_level_emit();

-- Boss derrotado: cada pessoa do boss (a dona do solo, quem é do clã, quem é do projeto)
create function public.bosses_defeated_emit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.defeated_at is null or old.defeated_at is not null then
    return null;
  end if;
  for v_user in
    select new.scope_id where new.scope = 'user'
    union select user_id from public.clan_members where new.scope = 'clan' and clan_id = new.scope_id
    union select user_id from public.folder_members where new.scope = 'project' and folder_id = new.scope_id
  loop
    perform public.automation_emit('boss.derrotado',
      jsonb_build_object('boss', new.id, 'boss_nome', new.name, 'nivel', new.level), v_user, null,
      'bd|' || new.id || '|' || v_user);
  end loop;
  return null;
end;
$$;
create trigger bosses_defeated_emit after update of defeated_at on public.bosses
  for each row execute function public.bosses_defeated_emit();

-- Marco atingido
create function public.milestones_done_emit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_root uuid := public.folder_root(new.folder_id);
  -- Quem marcou; feito pelo servidor, quem mexeu por último ou quem criou
  v_by uuid := coalesce(auth.uid(), new.updated_by, new.created_by);
begin
  if new.done_at is null or (tg_op = 'UPDATE' and old.done_at is not null) then
    return null;
  end if;
  perform public.automation_emit('marco.atingido',
    jsonb_strip_nulls(jsonb_build_object('marco', new.id, 'marco_nome', new.name, 'projeto', v_root,
      'projeto_nome', (select name from public.folders where id = v_root), 'por', v_by)),
    v_by, v_root, 'mc|' || new.id || '|' || new.done_at);
  return null;
end;
$$;
create trigger milestones_done_emit after insert or update of done_at on public.milestones
  for each row execute function public.milestones_done_emit();

-- ---------------------------------------------------------------------------------------------
-- O executor recebe também quem é a dona (para `usuario.*`, o fuso e o idioma dos textos)
-- ---------------------------------------------------------------------------------------------
create or replace function public.automation_claim(p_limit integer default 20)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.automation_events;
  v_out jsonb;
begin
  for v_event in
    select * from public.automation_events
    where processed_at is null and available_at <= now()
    order by available_at
    for update skip locked
    limit 100
  loop
    insert into public.automation_runs (rule_id, event_id, state)
    select r.id, v_event.id, jsonb_build_object('evento', v_event.payload, 'var', '{}'::jsonb)
    from public._automation_matching(v_event.kind, v_event.owner_id, v_event.folder_id, v_event.payload) r
    on conflict (rule_id, event_id) do nothing;
    update public.automation_events
    set processed_at = now(), claimed_at = now(), attempts = attempts + 1
    where id = v_event.id;
  end loop;

  update public.automation_runs u set status = 'cancelada', finished_at = now()
  from public.automation_rules r
  where r.id = u.rule_id and u.status in ('pendente', 'esperando') and (not r.enabled or r.trigger is not null);

  update public.automation_runs set status = 'falhou', finished_at = now(), error = 'O executor parou no meio 5 vezes'
  where status = 'rodando' and claimed_at < now() - interval '2 minutes' and attempts >= 5;

  with alvo as (
    select id from public.automation_runs
    where status = 'pendente'
       or (status = 'rodando' and claimed_at < now() - interval '2 minutes')
       or (status = 'esperando' and resume_at <= now())
    order by started_at
    for update skip locked
    limit greatest(least(p_limit, 200), 1)
  ), feito as (
    update public.automation_runs u
    set status = 'rodando', claimed_at = clock_timestamp(), attempts = u.attempts + 1, resume_at = null
    from alvo where u.id = alvo.id
    returning u.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'claimed_at', f.claimed_at, 'step', f.step, 'state', f.state,
    'scope', r.scope, 'rule_id', r.id, 'rule_name', r.name, 'definition', r.definition,
    'fuso', coalesce(p.timezone, 'America/Sao_Paulo'), 'idioma', coalesce(p.locale, 'pt-BR'),
    'usuario', jsonb_build_object('nome', p.display_name, 'nivel', p.level, 'sequencia', p.streak,
                                  'xp', p.xp))), '[]')
  into v_out
  from feito f
  join public.automation_rules r on r.id = f.rule_id
  left join public.profiles p on p.id = r.owner_id;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Importação e modelos não emitem eventos
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_from_template(p_name text, p_icon text, p_data jsonb, p_shared boolean DEFAULT true, p_project boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  -- Modelo, kit e importação criam o projeto inteiro de uma vez: não emitem eventos de automação (V14 §3)
  perform set_config('questlist.bulk', '1', true);
  if jsonb_typeof(p_data -> 'pages') <> 'array' or jsonb_array_length(p_data -> 'pages') = 0
     or jsonb_array_length(p_data -> 'pages') > 30 then
    raise exception 'Modelo inválido (de 1 a 30 páginas)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data -> 'deps') = 'array' and jsonb_array_length(p_data -> 'deps') > 300 then
    raise exception 'No máximo 300 dependências por modelo' using errcode = '22023';
  end if;

  -- Compartilhado já vira projeto pelo gatilho; pessoal é projeto quando pedem (importar, meus modelos)
  insert into public.folders (id, owner_id, name, icon, is_shared, kind, position)
  values (v_folder_id, auth.uid(), trim(p_name), nullif(trim(p_icon), ''), p_shared,
          case when p_shared or p_project then 'project' else 'folder' end,
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

revoke execute on function public._automation_wants(text, uuid, uuid), public._automation_task_payload(uuid, uuid),
  public.task_events_emit(), public.profiles_level_emit(), public.bosses_defeated_emit(),
  public.milestones_done_emit(), public.automation_emit(text, jsonb, uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.automation_claim(integer) from public, anon, authenticated;
grant execute on function public.automation_claim(integer) to service_role;
