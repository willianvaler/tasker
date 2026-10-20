-- ESCOPO_V10 §2 (VI1, D232): tarefa privada (padrão), só para amigos ou pública.
-- O marcador vale nas pastas pessoais. Quem não é da pasta lê só pela RPC `profile_tasks` (título,
-- data, estado, página), nunca pela RLS de `tasks`: nenhuma consulta de tarefas fica mais cara (D70)
-- e notas, anexos, comentários e responsáveis não saem. Em projeto (pasta compartilhada), o marcador
-- não abre nada: vale quem é do projeto.

alter table public.tasks add column visibility text not null default 'private'
  check (visibility in ('private', 'friends', 'public'));
grant insert (visibility), update (visibility) on public.tasks to authenticated;
create index tasks_visible_idx on public.tasks (created_by, visibility) where visibility <> 'private';

CREATE OR REPLACE FUNCTION public._insert_batch_task(p_page_id uuid, p_parent_id uuid, p_item jsonb, p_position double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_done boolean := coalesce((p_item ->> 'done')::boolean, false);
  v_kind text;
  v_key text;
  v_completion uuid;
  v_page public.pages;
  v_task public.tasks;
  v_recurrence jsonb := case when jsonb_typeof(p_item -> 'recurrence') = 'object' then p_item -> 'recurrence' end;
  v_habit_kind text := coalesce(p_item ->> 'habit_kind', 'check');
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_done then
    v_kind := public.task_cycle_kind(v_page.view_type, v_page.reset_cycle, v_recurrence);
    v_key := public.cycle_key_for(v_kind, public.folder_timezone(v_page.folder_id), now(), v_page.manual_cycle);
  end if;

  insert into public.tasks (
    id, page_id, parent_task_id, title, priority, due_date, due_time, remind_before, labels, recurrence, meta, position,
    habit_kind, habit_target, created_by, status, completed_by, completed_at, done_cycle_key, repeat_plan, visibility
  ) values (
    coalesce((p_item ->> 'id')::uuid, gen_random_uuid()),
    p_page_id,
    p_parent_id,
    trim(p_item ->> 'title'),
    coalesce((p_item ->> 'priority')::smallint, 0),
    (p_item ->> 'due_date')::date,
    -- Horário e lembrete (D206): só com data
    case when p_item ->> 'due_date' is not null then (p_item ->> 'due_time')::time end,
    case when p_item ->> 'due_date' is not null and p_item ->> 'due_time' is not null
         then (p_item ->> 'remind_before')::integer end,
    coalesce(array(select jsonb_array_elements_text(p_item -> 'labels')), '{}'),
    v_recurrence,
    case when jsonb_typeof(p_item -> 'meta') = 'object' then p_item -> 'meta' end,
    p_position,
    v_habit_kind,
    case when v_habit_kind = 'counter' then coalesce((p_item ->> 'habit_target')::smallint, 1) end,
    auth.uid(),
    case when v_done then 'done' else 'todo' end::public.task_status,
    case when v_done then auth.uid() end,
    case when v_done then now() end,
    v_key,
    case when jsonb_typeof(p_item -> 'repeat_plan') = 'object' then p_item -> 'repeat_plan' end,
    -- Visibilidade (V10 §2): +publica / +amigos na escrita rápida; o resto é privada
    case when p_item ->> 'visibility' in ('friends', 'public') then p_item ->> 'visibility' else 'private' end
  )
  returning * into v_task;
  v_id := v_task.id;

  -- Responsáveis: o trigger confere que o user_id é membro; nome pendente é livre
  insert into public.task_assignees (task_id, user_id, pending_name)
  select v_id, (a ->> 'user_id')::uuid, case when a ? 'user_id' then null else a ->> 'pending_name' end
  from jsonb_array_elements(case when jsonb_typeof(p_item -> 'assignees') = 'array' then p_item -> 'assignees' else '[]' end) a
  on conflict do nothing;

  if v_done then
    insert into public.task_completions (task_id, folder_id, user_id, cycle_key)
    values (v_id, v_task.folder_id, auth.uid(), v_key)
    returning id into v_completion;
    perform public._award_completion(v_task, v_page, v_completion, v_kind, true);
    perform public._refresh_profile_stats(auth.uid());
  end if;
  return v_id;
end;
$function$;

/**
 * Perfil de uma pessoa pelo nick: nome, nick, se é amiga e as tarefas que ela deixou ver
 * (públicas para qualquer conta; de amigos só para amigos), de pastas pessoais. Em andamento,
 * as próximas e as concluídas nos últimos 7 dias; até 100.
 */
create function public.profile_tasks(p_username text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_user public.profiles;
  v_friends boolean;
  v_status text;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  select * into v_user from public.profiles where username = lower(ltrim(trim(coalesce(p_username, '')), '@'));
  if v_user.id is null then
    return null;
  end if;
  v_friends := v_user.id = v_me or public.are_friends(v_me, v_user.id);
  select f.status into v_status from public.friendships f
  where f.user_a = least(v_me, v_user.id) and f.user_b = greatest(v_me, v_user.id);
  return jsonb_build_object(
    'user_id', v_user.id,
    'display_name', v_user.display_name,
    'username', v_user.username,
    'avatar_url', v_user.avatar_url,
    'me', v_user.id = v_me,
    'friendship', v_status,
    'friend_request_incoming', exists (select 1 from public.friendships f
      where f.user_a = least(v_me, v_user.id) and f.user_b = greatest(v_me, v_user.id)
        and f.status = 'pending' and f.requested_by = v_user.id),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'status', t.status, 'due_date', t.due_date,
        'completed_at', t.completed_at, 'visibility', t.visibility, 'page', p.name, 'page_icon', p.icon)
        order by (t.status = 'done'), t.due_date nulls last, t.completed_at desc nulls last)
      from (
        select t.* from public.tasks t
        where t.created_by = v_user.id and t.parent_task_id is null
          and (t.visibility = 'public' or (t.visibility = 'friends' and v_friends))
          and (t.status <> 'done' or t.completed_at > now() - interval '7 days')
        order by t.created_at desc limit 100
      ) t
      join public.pages p on p.id = t.page_id
      join public.folders f on f.id = public.folder_root(t.folder_id)
      where not f.is_shared
    ), '[]')
  );
end;
$$;
revoke execute on function public.profile_tasks(text) from public, anon;
grant execute on function public.profile_tasks(text) to authenticated;
