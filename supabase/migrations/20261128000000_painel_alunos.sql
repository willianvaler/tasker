-- V3 §3.4 (L5): painel "Alunos" do autor. Números por aluno (última atividade, o ciclo atual,
-- aderência nas últimas 4 semanas, observações novas), histórico com as cargas de cada conclusão,
-- lembrete ("não vejo treino há 5 dias") e arquivar. Pede page.view_progress (lembrar e arquivar,
-- page.share).

alter table public.share_checks add column values jsonb
  check (values is null or jsonb_typeof(values) = 'array');

create or replace function public.check_item(p_task_id uuid, p_done boolean, p_note text default null)
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
    -- Guarda junto as séries registradas (carga, repetições): a evolução no painel do autor
    insert into public.share_checks (task_id, page_id, user_id, cycle_key, note, values)
    values (p_task_id, v_task.page_id, auth.uid(), v_key, nullif(trim(left(p_note, 500)), ''),
            (select logged_values from public.task_progress
             where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key))
    on conflict (task_id, user_id, cycle_key) do update
    set note = coalesce(excluded.note, public.share_checks.note),
        values = coalesce(excluded.values, public.share_checks.values);
  else
    delete from public.share_checks where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key;
  end if;
  return jsonb_build_object('done', p_done, 'cycle_key', v_key);
end;
$$;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested',
  'join_approved', 'task_ready', 'prereq_reopened', 'page_reminder'));

create function public.page_students(p_page_id uuid)
returns table (
  share_id uuid, recipient_id uuid, name text, mode text, accepted_at timestamptz,
  last_activity timestamptz, done_now integer, items integer, sessions integer, expected integer,
  notes_recent integer, last_reminded_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_page public.pages;
  v_key text;
  v_kind text;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.has_permission(v_page.folder_id, 'page.view_progress') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, null);
  v_key := public.page_cycle_key(p_page_id);
  return query
  select s.id, s.recipient_id, coalesce(pr.display_name, s.recipient_email), s.mode, s.accepted_at,
         greatest((select max(c.done_at) from public.share_checks c
                   where c.page_id = p_page_id and c.user_id = s.recipient_id),
                  (select max(tp.updated_at) from public.task_progress tp
                   join public.tasks t on t.id = tp.task_id
                   where t.page_id = p_page_id and tp.user_id = s.recipient_id)),
         (select count(*)::integer from public.share_checks c
          where c.page_id = p_page_id and c.user_id = s.recipient_id and c.cycle_key = v_key),
         (select count(*)::integer from public.tasks t
          where t.page_id = p_page_id and not exists (select 1 from public.tasks k where k.parent_task_id = t.id)),
         -- Sessões: ciclos (ou dias, sem reinício) com alguma marcação nas últimas 4 semanas
         (select count(distinct case when v_kind = 'once' then c.done_at::date::text else c.cycle_key end)::integer
          from public.share_checks c
          where c.page_id = p_page_id and c.user_id = s.recipient_id and c.done_at > now() - interval '28 days'),
         case v_kind when 'weekly' then 4 when 'daily' then 28 when 'monthly' then 1 end,
         (select count(*)::integer from public.share_checks c
          where c.page_id = p_page_id and c.user_id = s.recipient_id and c.note is not null
            and c.done_at > now() - interval '7 days'),
         s.last_reminded_at
  from public.page_shares s
  left join public.profiles pr on pr.id = s.recipient_id
  where s.page_id = p_page_id and s.mode = 'live' and s.status = 'active'
  order by coalesce(pr.display_name, s.recipient_email);
end;
$$;

-- Lembrete para o aluno (no máximo um por dia)
create function public.remind_student(p_share_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_share public.page_shares;
  v_page public.pages;
  v_last timestamptz;
begin
  select * into v_share from public.page_shares where id = p_share_id;
  select * into v_page from public.pages where id = v_share.page_id;
  if v_share.id is null or v_share.status <> 'active' or not public.can_share_page(v_share.page_id) then
    raise exception 'Aluno não encontrado' using errcode = 'P0002';
  end if;
  if v_share.last_reminded_at > now() - interval '1 day' then
    raise exception 'Já lembrado nas últimas 24 horas' using errcode = '22023';
  end if;
  select greatest(max(c.done_at), v_share.accepted_at) into v_last from public.share_checks c
  where c.page_id = v_share.page_id and c.user_id = v_share.recipient_id;
  insert into public.notifications (user_id, kind, payload)
  values (v_share.recipient_id, 'page_reminder', jsonb_build_object(
    'page_id', v_page.id, 'page_name', v_page.name,
    'by', (select display_name from public.profiles where id = auth.uid()),
    'days', greatest(0, extract(day from now() - coalesce(v_last, v_share.created_at))::integer)));
  update public.page_shares set last_reminded_at = now() where id = p_share_id;
end;
$$;

-- Arquivar: o aluno deixa de receber; o histórico fica
create function public.archive_page_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.page_shares s set status = 'archived'
  where s.id = p_share_id and s.status = 'active' and public.can_share_page(s.page_id);
end;
$$;

revoke execute on function public.page_students(uuid), public.remind_student(uuid),
  public.archive_page_share(uuid) from public, anon;
grant execute on function public.page_students(uuid), public.remind_student(uuid),
  public.archive_page_share(uuid) to authenticated;

-- A conclusão do aluno pelo log_rep guarda as séries com a última incluída
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

  -- Aluno: a conclusão guarda as séries desta vez (a última incluída) para a evolução do autor
  if v_recipient then
    update public.share_checks set values = v_values
    where task_id = p_task_id and user_id = auth.uid() and cycle_key = v_key;
  end if;
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
