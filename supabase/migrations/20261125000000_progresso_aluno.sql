-- V3 §3 (L2): progresso por pessoa na página recebida ao vivo. A tarefa (definição) é única; a
-- conclusão de cada aluno fica em `share_checks`, por (tarefa, pessoa, ciclo da página): o treino
-- semanal "reinicia" para cada um sem apagar o histórico (o painel do autor usa). As séries
-- (task_progress, J1) já eram por pessoa: o log_rep agora aceita o aluno e, no total, marca o
-- item dele em vez de concluir a tarefa do autor. Sem XP para o aluno por enquanto (D134).

create table public.share_checks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cycle_key text not null,
  done_at timestamptz not null default now(),
  -- Observação do aluno ("senti dor no ombro")
  note text check (char_length(note) <= 500),
  unique (task_id, user_id, cycle_key)
);
create index share_checks_page on public.share_checks (page_id, user_id, cycle_key);

alter table public.share_checks enable row level security;
-- O aluno vê as dele; quem acompanha a página (page.view_progress na pasta), de todos
create policy "share_checks: as minhas e as da página" on public.share_checks
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.pages p
               where p.id = page_id and public.has_permission(p.folder_id, 'page.view_progress'))
  );
revoke insert, update, delete on public.share_checks from anon, authenticated;
alter publication powersync add table public.share_checks;

-- Ciclo da página agora (a mesma conta das conclusões)
create function public.page_cycle_key(p_page_id uuid, p_recurrence jsonb default null)
returns text
language sql stable security definer set search_path = ''
as $$
  select public.cycle_key_for(
    public.task_cycle_kind(p.view_type, p.reset_cycle, p_recurrence),
    public.folder_timezone(p.folder_id), now(), p.manual_cycle)
  from public.pages p where p.id = p_page_id;
$$;

-- Marcar/desmarcar um item da página recebida (o aluno), com observação opcional
create function public.check_item(p_task_id uuid, p_done boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_key text;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_page_recipient(v_task.page_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  v_key := public.page_cycle_key(v_task.page_id, v_task.recurrence);
  if p_done then
    insert into public.share_checks (task_id, page_id, user_id, cycle_key, note)
    values (p_task_id, v_task.page_id, auth.uid(), v_key, nullif(trim(left(p_note, 500)), ''))
    on conflict (task_id, user_id, cycle_key) do update
    set note = coalesce(excluded.note, public.share_checks.note);
  else
    delete from public.share_checks where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key;
  end if;
  return jsonb_build_object('done', p_done, 'cycle_key', v_key);
end;
$$;
revoke execute on function public.check_item(uuid, boolean, text) from public, anon;
grant execute on function public.check_item(uuid, boolean, text) to authenticated;

create or replace function public.log_rep(p_task_id uuid, p_delta integer, p_values jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_page public.pages;
  v_total integer;
  v_key text;
  v_progress public.task_progress;
  v_current integer;
  v_new integer;
  v_values jsonb;
  v_result jsonb := '{}';
  v_waiting uuid[];
  -- Página recebida ao vivo: a conclusão é do aluno (share_checks), não da tarefa (D134)
  v_recipient boolean;
  v_done boolean;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  v_recipient := v_task.id is not null and not public.is_folder_member(v_task.folder_id)
                 and public.is_page_recipient(v_task.page_id);
  if v_task.id is null or not (v_recipient or public.is_folder_member(v_task.folder_id)) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not v_recipient and not public.has_permission(v_task.folder_id, 'task.complete',
                               public.is_task_assignee(v_task.id, auth.uid()), v_task.created_by = auth.uid()) then
    raise exception 'Seu cargo não conclui esta tarefa' using errcode = '42501';
  end if;
  if v_task.repeat_plan is null then
    raise exception 'Esta tarefa não tem repetições' using errcode = '22023';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Use +1 ou −1' using errcode = '22023';
  end if;
  v_total := (v_task.repeat_plan ->> 'total')::integer;

  select * into v_page from public.pages where id = v_task.page_id;
  v_key := public.cycle_key_for(
    public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_task.recurrence),
    public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  if v_key is null or v_key like 'r:%' then
    v_key := 'once';
  end if;

  select * into v_progress from public.task_progress where task_id = p_task_id and user_id = auth.uid();
  if v_progress.cycle_key is distinct from v_key then
    v_progress.done_reps := 0;
    v_progress.logged_values := '[]';
  end if;
  v_done := case when v_recipient
                 then exists (select 1 from public.share_checks
                              where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key)
                 else v_task.status = 'done' end;
  v_current := case when v_done then v_total
                    else least(coalesce(v_progress.done_reps, 0), v_total - 1) end;
  v_values := coalesce(v_progress.logged_values, '[]');

  if p_delta = 1 then
    if v_done then
      return jsonb_build_object('done_reps', v_total, 'total', v_total, 'completed', true);
    end if;
    -- Tarefa bloqueada não começa (a mesma regra do guarda de iniciar/concluir)
    if v_current = 0 and current_setting('app.force_unblock', true) is distinct from v_task.id::text then
      v_waiting := public.task_blockers(v_task.id);
      if cardinality(v_waiting) > 0 then
        raise exception 'Tarefa bloqueada. Aguardando: %',
          (select string_agg(title, ', ') from public.tasks where id = any (v_waiting))
          using errcode = '22023';
      end if;
      if cardinality(public.page_blockers(v_task.page_id)) > 0 then
        raise exception 'Lista bloqueada' using errcode = '22023';
      end if;
    end if;
    v_new := v_current + 1;
    v_values := v_values || jsonb_build_array(coalesce(p_values, '{}'));
    if v_new >= v_total and v_recipient then
      perform public.check_item(p_task_id, true);
    elsif v_new >= v_total then
      v_result := public.complete_task(p_task_id);
      -- Recorrente comum: concluir avança a data e a tarefa segue aberta, com a conta zerada
      if (select status from public.tasks where id = p_task_id) <> 'done' then
        v_new := 0;
        v_values := '[]';
      end if;
    end if;
  else
    if v_done and v_recipient then
      perform public.check_item(p_task_id, false);
      v_new := v_total - 1;
    elsif v_done then
      v_result := public.uncomplete_task(p_task_id);
      v_new := v_total - 1;
    else
      v_new := greatest(v_current - 1, 0);
    end if;
    if jsonb_array_length(v_values) > 0 then
      v_values := v_values - (jsonb_array_length(v_values) - 1);
    end if;
  end if;

  insert into public.task_progress (task_id, user_id, done_reps, logged_values, cycle_key, updated_at)
  values (p_task_id, auth.uid(), v_new, v_values, v_key, now())
  on conflict (task_id, user_id) do update
  set done_reps = excluded.done_reps, logged_values = excluded.logged_values,
      cycle_key = excluded.cycle_key, updated_at = excluded.updated_at;

  v_done := case when v_recipient
                 then exists (select 1 from public.share_checks
                              where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key)
                 else (select status from public.tasks where id = p_task_id) = 'done' end;
  return coalesce(v_result, '{}') || jsonb_build_object(
    'done_reps', case when v_done then v_total else v_new end,
    'total', v_total,
    'completed', v_done);
end;
$$;


-- Marcar também pela fila do aparelho (offline: o treino na academia sem sinal)
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
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'complete_tree' then
      return jsonb_build_object('count', public.complete_tree((p_args ->> 'p_task_id')::uuid));
    when 'start_task' then
      return to_jsonb(public.start_task((p_args ->> 'p_task_id')::uuid,
                                        coalesce((p_args ->> 'p_started')::boolean, true)));
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    when 'log_rep' then
      return public.log_rep((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                            p_args -> 'p_values');
    when 'start_timer' then
      return to_jsonb(public.start_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_kind',
                                         (p_args ->> 'p_started_at')::timestamptz,
                                         (p_args ->> 'p_seconds')::integer,
                                         (p_args ->> 'p_task_id')::uuid,
                                         coalesce(p_args -> 'p_config', '{}'),
                                         p_args ->> 'p_device'));
    when 'update_timer' then
      return to_jsonb(public.update_timer((p_args ->> 'p_id')::uuid, p_args ->> 'p_action',
                                          coalesce((p_args ->> 'p_seconds')::integer, 0),
                                          coalesce((p_args ->> 'p_at')::timestamptz, now())));
    when 'log_time' then
      return to_jsonb(public.log_time((p_args ->> 'p_id')::uuid, (p_args ->> 'p_task_id')::uuid,
                                      (p_args ->> 'p_minutes')::integer, (p_args ->> 'p_day')::date,
                                      p_args ->> 'p_note'));
    when 'check_item' then
      return public.check_item((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_done')::boolean,
                               p_args ->> 'p_note');
    when 'delete_time_entry' then
      perform public.delete_time_entry((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;

-- O autor acompanha as séries e cargas registradas pelos alunos (painel "Alunos", L5)
create policy "task_progress: quem acompanha a página" on public.task_progress
  for select to authenticated using (
    exists (select 1 from public.tasks t join public.pages p on p.id = t.page_id
            where t.id = task_id and public.has_permission(p.folder_id, 'page.view_progress'))
  );
