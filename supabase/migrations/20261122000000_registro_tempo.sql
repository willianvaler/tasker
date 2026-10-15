-- V3 §5.2 (K3): lançar tempo à mão e apagar um registro. Id gerado no aparelho (o reenvio da
-- fila não duplica). Lançar pede `timer.use` na tarefa (Colaborador: nas dele); apagar, ser o dono
-- do registro. O cronômetro (timer `stopwatch` com tarefa) já vira registro no `update_timer`.

create function public.log_time(p_id uuid, p_task_id uuid, p_minutes integer, p_day date default null,
                                p_note text default null)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_entry public.time_entries;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  select * into v_entry from public.time_entries where id = p_id;
  if v_entry.id is not null then
    return v_entry;
  end if;
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or not public.is_folder_member(v_task.folder_id) then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_task.folder_id, 'timer.use',
                               public.is_task_assignee(v_task.id, auth.uid()), v_task.created_by = auth.uid()) then
    raise exception 'Seu cargo não registra tempo nesta tarefa' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes not between 1 and 1440 then
    raise exception 'Tempo entre 1 minuto e 24 horas' using errcode = '22023';
  end if;
  -- Lançado num dia: termina ao meio-dia dele (no fuso da pasta); sem dia, agora
  v_end := case when p_day is null then now()
                else (p_day + time '12:00') at time zone public.folder_timezone(v_task.folder_id) end;
  insert into public.time_entries (id, user_id, task_id, source, started_at, ended_at, minutes, note)
  values (p_id, auth.uid(), p_task_id, 'manual', v_end - make_interval(mins => p_minutes), v_end, p_minutes,
          nullif(trim(left(p_note, 200)), ''))
  returning * into v_entry;
  return v_entry;
end;
$$;

create function public.delete_time_entry(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.time_entries where id = p_id and user_id = auth.uid();
  if not found and exists (select 1 from public.time_entries where id = p_id) then
    raise exception 'Só quem registrou apaga' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.log_time(uuid, uuid, integer, date, text) from public, anon;
revoke execute on function public.delete_time_entry(uuid) from public, anon;
grant execute on function public.log_time(uuid, uuid, integer, date, text) to authenticated;
grant execute on function public.delete_time_entry(uuid) to authenticated;

-- Tempo também pela fila do aparelho (offline)
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
    when 'delete_time_entry' then
      perform public.delete_time_entry((p_args ->> 'p_id')::uuid);
      return '{}'::jsonb;
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;
