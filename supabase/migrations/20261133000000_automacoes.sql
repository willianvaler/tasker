-- V3 §2.8 (M6): automações "quando… então…", no servidor. Uma regra vale para a pasta raiz (o
-- projeto ou a pasta pessoal) e, se quiser, só para uma página. Gatilhos: tarefa concluída, ficou
-- pronta, foi atribuída, página concluída e prazo vencido (cron). Ações: criar tarefa, atribuir,
-- notificar, pôr etiqueta, mover de página e começar um descanso.
--
-- Proteção: no máximo 20 regras por pasta; encadeamento até 3 níveis (uma automação que conclui
-- algo que dispara outra); a mesma regra roda uma vez por tarefa em cada operação; e uma ação que
-- falha fica no registro sem desfazer o que a pessoa fez.

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  page_id uuid references public.pages (id) on delete cascade,
  trigger text not null check (trigger in ('task_done', 'task_ready', 'task_assigned', 'page_done', 'task_overdue')),
  action text not null check (action in ('create_task', 'assign', 'notify', 'add_label', 'move', 'rest_timer')),
  params jsonb not null default '{}' check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 2000),
  enabled boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  runs integer not null default 0,
  last_run_at timestamptz
);
create index automation_rules_folder on public.automation_rules (folder_id) where enabled;

create table public.automation_log (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  task_id uuid,
  at timestamptz not null default now(),
  ok boolean not null,
  message text
);
create index automation_log_rule on public.automation_log (rule_id, at desc);
create index automation_log_overdue on public.automation_log (rule_id, task_id, at);

create function public.automation_rules_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select parent_id from public.folders where id = new.folder_id) is not null then
    raise exception 'A regra vale para a pasta principal (o projeto)' using errcode = '22023';
  end if;
  if new.page_id is not null and (select public.folder_root(folder_id) from public.pages where id = new.page_id) <> new.folder_id then
    raise exception 'A página precisa ser desta pasta' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.automation_rules where folder_id = new.folder_id) >= 20 then
    raise exception 'No máximo 20 automações por projeto' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger automation_rules_check before insert or update on public.automation_rules
  for each row execute function public.automation_rules_check();

alter table public.automation_rules enable row level security;
alter table public.automation_log enable row level security;
create policy "automation_rules_select" on public.automation_rules for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "automation_rules_write" on public.automation_rules for all to authenticated
  using (public.has_permission(folder_id, 'automation.manage'))
  with check (public.has_permission(folder_id, 'automation.manage'));
create policy "automation_log_select" on public.automation_log for select to authenticated
  using (exists (select 1 from public.automation_rules r where r.id = rule_id and public.is_folder_member(r.folder_id)));
revoke insert, update on public.automation_rules from anon, authenticated;
grant insert (id, folder_id, page_id, trigger, action, params, enabled), update (page_id, params, enabled)
  on public.automation_rules to authenticated;
revoke insert, update, delete on public.automation_log from anon, authenticated;

-- Uma ação de uma regra sobre uma tarefa. Erro vira registro (não desfaz quem disparou).
create function public._automation_act(p_rule public.automation_rules, p_task public.tasks)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p jsonb := p_rule.params;
  v_target uuid;
  v_label text;
begin
  case p_rule.action
    when 'create_task' then
      insert into public.tasks (page_id, title, created_by, position)
      values (coalesce((v_p ->> 'page_id')::uuid, p_task.page_id),
              left(coalesce(nullif(trim(v_p ->> 'title'), ''), 'Nova tarefa'), 500),
              coalesce(auth.uid(), p_rule.created_by),
              coalesce((select max(position) + 1 from public.tasks
                        where page_id = coalesce((v_p ->> 'page_id')::uuid, p_task.page_id) and parent_task_id is null), 0));
    when 'assign' then
      insert into public.task_assignees (task_id, user_id) values (p_task.id, (v_p ->> 'user_id')::uuid)
      on conflict do nothing;
    when 'notify' then
      for v_target in
        select case when v_p ->> 'to' = 'assignees' then a.user_id end
        from public.task_assignees a where a.task_id = p_task.id and a.user_id is not null and v_p ->> 'to' = 'assignees'
        union select (v_p ->> 'user_id')::uuid where v_p ->> 'user_id' is not null
        union select p_rule.created_by where coalesce(v_p ->> 'to', 'creator') = 'creator'
      loop
        continue when v_target is null;
        insert into public.notifications (user_id, kind, payload)
        values (v_target, 'automation', jsonb_build_object(
          'task_id', p_task.id, 'title', p_task.title, 'message', left(v_p ->> 'message', 200)));
      end loop;
    when 'add_label' then
      v_label := lower(regexp_replace(coalesce(v_p ->> 'label', ''), '^#', ''));
      if v_label <> '' and not (v_label = any (p_task.labels)) then
        update public.tasks set labels = array_append(labels, v_label) where id = p_task.id;
      end if;
    when 'move' then
      if p_task.parent_task_id is null and (v_p ->> 'page_id') is not null then
        update public.tasks set page_id = (v_p ->> 'page_id')::uuid where id = p_task.id;
      end if;
    when 'rest_timer' then
      if auth.uid() is not null then
        perform public.start_timer(gen_random_uuid(), 'rest', now(),
                                   least(greatest(coalesce((v_p ->> 'seconds')::integer, 60), 5), 3600),
                                   p_task.id, jsonb_build_object('label', p_task.title, 'after', true));
      end if;
  end case;
  insert into public.automation_log (rule_id, task_id, ok) values (p_rule.id, p_task.id, true);
exception when others then
  insert into public.automation_log (rule_id, task_id, ok, message) values (p_rule.id, p_task.id, false, left(sqlerrm, 300));
end;
$$;

-- Roda as regras de um gatilho para uma tarefa (com os limites de encadeamento e repetição)
create function public._run_automations(p_trigger text, p_task_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_root uuid;
  v_rule public.automation_rules;
  v_depth integer := coalesce(nullif(current_setting('app.automation_depth', true), '')::integer, 0);
  v_seen text := coalesce(current_setting('app.automation_seen', true), '');
begin
  if v_depth >= 3 then
    return;
  end if;
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    return;
  end if;
  v_root := public.folder_root(v_task.folder_id);
  for v_rule in
    select * from public.automation_rules
    where folder_id = v_root and enabled and trigger = p_trigger
      and (page_id is null or page_id = v_task.page_id)
    order by created_at
  loop
    continue when position(v_rule.id::text || ':' || v_task.id::text in v_seen) > 0;
    v_seen := v_seen || ',' || v_rule.id::text || ':' || v_task.id::text;
    perform set_config('app.automation_seen', v_seen, true);
    perform set_config('app.automation_depth', (v_depth + 1)::text, true);
    perform public._automation_act(v_rule, v_task);
    perform set_config('app.automation_depth', v_depth::text, true);
    update public.automation_rules set runs = runs + 1, last_run_at = now() where id = v_rule.id;
  end loop;
end;
$$;

-- Gatilhos a partir do histórico (concluída, pronta, atribuída) e página concluída
create function public.task_events_automations()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_page uuid;
begin
  if new.kind = 'completed' then
    perform public._run_automations('task_done', new.task_id);
    select page_id into v_page from public.tasks where id = new.task_id;
    -- Página concluída: nenhuma folha aberta
    if v_page is not null and not exists (
      select 1 from public.tasks t where t.page_id = v_page and t.status <> 'done'
        and not exists (select 1 from public.tasks k where k.parent_task_id = t.id)
    ) then
      perform public._run_automations('page_done', new.task_id);
    end if;
  elsif new.kind = 'ready' then
    perform public._run_automations('task_ready', new.task_id);
  elsif new.kind = 'assigned' then
    perform public._run_automations('task_assigned', new.task_id);
  end if;
  return null;
end;
$$;
create trigger task_events_automations after insert on public.task_events
  for each row execute function public.task_events_automations();

-- Prazo vencido: uma vez por dia por regra e tarefa (cron)
create function public.run_overdue_automations()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select r.id as rule_id, t.id as task_id
    from public.automation_rules r
    join public.tasks t on public.folder_root(t.folder_id) = r.folder_id
    where r.enabled and r.trigger = 'task_overdue' and t.status <> 'done' and t.due_date is not null
      and (r.page_id is null or r.page_id = t.page_id)
      and t.due_date < (now() at time zone public.folder_timezone(t.folder_id))::date
      and not exists (select 1 from public.automation_log l
                      where l.rule_id = r.id and l.task_id = t.id and l.at > now() - interval '20 hours')
  loop
    perform public._run_automations('task_overdue', v_row.task_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
select cron.schedule('questlist-automacoes-prazo', '7 * * * *', $$select public.run_overdue_automations()$$);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested',
  'join_approved', 'task_ready', 'prereq_reopened', 'page_reminder', 'automation'));

revoke execute on function public._automation_act(public.automation_rules, public.tasks),
  public._run_automations(text, uuid), public.run_overdue_automations() from public, anon, authenticated;
