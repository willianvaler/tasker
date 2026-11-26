-- CS2 (ESCOPO_V15 §4, D381): rodízio de tarefas domésticas. Uma tarefa de projeto com membros
-- ganha uma ordem de pessoas; a vez passa quando alguém conclui (modo "por vez") ou na virada da
-- semana (modo "por semana"). Quem está na vez é a responsável da tarefa (task_assignees), então o
-- aviso "te atribuiu" já sai pelo gatilho de sempre. Escrita só por RPC.

create table public.task_rotations (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  -- Desnormalizado (= pasta da tarefa), mantido por trigger, como nos responsáveis
  folder_id uuid not null references public.folders (id) on delete cascade,
  members uuid[] not null check (cardinality(members) between 2 and 20),
  mode text not null default 'turn' check (mode in ('turn', 'week')),
  current_index integer not null default 0 check (current_index >= 0),
  -- Semana (ISO, fuso da pasta) em que a vez foi definida, para o modo "por semana"
  week_key text,
  -- A conclusão que passou a vez por último (desfazer devolve a vez)
  last_completion uuid,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create index task_rotations_folder_id_idx on public.task_rotations (folder_id);

alter table public.task_rotations enable row level security;
create policy "task_rotations_select" on public.task_rotations for select to authenticated
  using (public.is_folder_member(folder_id));
revoke insert, update, delete on public.task_rotations from anon, authenticated;

alter publication supabase_realtime add table public.task_rotations;

-- Tarefa mudou de pasta: o rodízio acompanha
create function public.tasks_rotation_folder()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.task_rotations set folder_id = new.folder_id where task_id = new.id;
  return null;
end;
$$;
create trigger tasks_rotation_folder
  after update of folder_id on public.tasks
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.tasks_rotation_folder();

create function public._rotation_week(p_folder uuid, p_at timestamptz default now())
returns text
language sql stable security definer set search_path = ''
as $$
  select to_char(p_at at time zone public.folder_timezone(p_folder), 'IYYY-"W"IW');
$$;

-- Pessoa ainda no projeto (saiu do projeto ou apagou a conta: a vez pula por cima)
create function public._rotation_active(p_folder uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.folder_members
                 where folder_id = public.folder_root(p_folder) and user_id = p_user);
$$;

-- Próximo índice (passos = 1 avança, -1 volta), pulando quem saiu do projeto
create function public._rotation_step(p_rot public.task_rotations, p_steps integer)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_n integer := cardinality(p_rot.members);
  v_i integer := p_rot.current_index;
  v_dir integer := sign(p_steps)::integer;
begin
  for k in 1..abs(p_steps) loop
    for tries in 1..v_n loop
      v_i := ((v_i + v_dir) % v_n + v_n) % v_n;
      exit when public._rotation_active(p_rot.folder_id, p_rot.members[v_i + 1]);
    end loop;
  end loop;
  return v_i;
end;
$$;

-- Põe quem está na vez como a única responsável da tarefa
create function public._rotation_assign(p_task uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rot public.task_rotations;
  v_user uuid;
begin
  select * into v_rot from public.task_rotations where task_id = p_task;
  if not found then return; end if;
  v_user := v_rot.members[v_rot.current_index + 1];
  if not public._rotation_active(v_rot.folder_id, v_user) then return; end if;
  delete from public.task_assignees
  where task_id = p_task and (user_id is distinct from v_user);
  insert into public.task_assignees (task_id, folder_id, user_id)
  select p_task, v_rot.folder_id, v_user
  where not exists (select 1 from public.task_assignees where task_id = p_task and user_id = v_user);
end;
$$;

-- Liga, muda ou desliga (p_members vazio) o rodízio. Pede task.assign no projeto
create function public.set_task_rotation(p_task uuid, p_members uuid[], p_mode text default 'turn')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_members uuid[];
  v_old public.task_rotations;
  v_index integer := 0;
begin
  select * into v_task from public.tasks where id = p_task;
  if not found then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_task.folder_id, 'task.assign') then
    raise exception 'Sem permissão para escolher responsáveis' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_members), 0) = 0 then
    delete from public.task_rotations where task_id = p_task;
    return;
  end if;
  if p_mode not in ('turn', 'week') then
    raise exception 'Modo de rodízio inválido' using errcode = '22023';
  end if;
  -- Sem repetir, na ordem dada
  select array_agg(u order by i) into v_members
  from (select distinct on (u) u, i from unnest(p_members) with ordinality as x (u, i) order by u, i) d;
  if cardinality(v_members) < 2 then
    raise exception 'O rodízio precisa de pelo menos 2 pessoas' using errcode = '22023';
  end if;
  if cardinality(v_members) > 20 then
    raise exception 'O rodízio aceita até 20 pessoas' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_members) u where not public._rotation_active(v_task.folder_id, u)) then
    raise exception 'Só membros do projeto entram no rodízio' using errcode = '22023';
  end if;
  -- Mudar a ordem mantém a vez de quem já estava nela, se continuar no rodízio
  select * into v_old from public.task_rotations where task_id = p_task;
  if found then
    v_index := coalesce(array_position(v_members, v_old.members[v_old.current_index + 1]), 1) - 1;
  end if;
  insert into public.task_rotations (task_id, folder_id, members, mode, current_index, week_key)
  values (p_task, v_task.folder_id, v_members, p_mode, v_index, public._rotation_week(v_task.folder_id))
  on conflict (task_id) do update
    set members = excluded.members, mode = excluded.mode, current_index = excluded.current_index,
        week_key = case when task_rotations.mode = excluded.mode then task_rotations.week_key
                        else excluded.week_key end,
        last_completion = null, updated_at = now();
  perform public._rotation_assign(p_task);
end;
$$;

-- Pular a vez (vai para a próxima pessoa) ou trocar com alguém (as duas trocam de lugar na ordem).
-- Pode quem escolhe responsáveis e a própria pessoa da vez
create function public.rotation_pass(p_task uuid, p_to uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rot public.task_rotations;
  v_current uuid;
  v_pos integer;
begin
  select * into v_rot from public.task_rotations where task_id = p_task for update;
  if not found then
    raise exception 'Esta tarefa não tem rodízio' using errcode = 'P0002';
  end if;
  v_current := v_rot.members[v_rot.current_index + 1];
  if not (public.has_permission(v_rot.folder_id, 'task.assign') or auth.uid() = v_current) then
    raise exception 'Só quem está na vez ou quem escolhe responsáveis pode passar a vez' using errcode = '42501';
  end if;
  if p_to is null then
    update public.task_rotations
    set current_index = public._rotation_step(v_rot, 1), last_completion = null, updated_at = now()
    where task_id = p_task;
  else
    v_pos := array_position(v_rot.members, p_to);
    if v_pos is null or not public._rotation_active(v_rot.folder_id, p_to) then
      raise exception 'Essa pessoa não está no rodízio' using errcode = '22023';
    end if;
    if p_to = v_current then return; end if;
    v_rot.members[v_pos] := v_current;
    v_rot.members[v_rot.current_index + 1] := p_to;
    update public.task_rotations
    set members = v_rot.members, last_completion = null, updated_at = now()
    where task_id = p_task;
  end if;
  perform public._rotation_assign(p_task);
end;
$$;

-- Estado para a tela: a ordem, a vez e quem fez quanto (no total e nesta semana)
create function public.task_rotation_state(p_task uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rot public.task_rotations;
  v_week text;
begin
  select * into v_rot from public.task_rotations where task_id = p_task;
  if not found or not public.is_folder_member(v_rot.folder_id) then
    return null;
  end if;
  v_week := public._rotation_week(v_rot.folder_id);
  return jsonb_build_object(
    'members', to_jsonb(v_rot.members),
    'mode', v_rot.mode,
    'current_index', v_rot.current_index,
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'total', c.total, 'week', c.week))
      from (
        select tc.user_id, count(*) as total,
               count(*) filter (where public._rotation_week(v_rot.folder_id, tc.completed_at) = v_week) as week
        from public.task_completions tc
        where tc.task_id = p_task and tc.user_id is not null
        group by tc.user_id
      ) c), '[]'::jsonb));
end;
$$;

-- Concluiu (modo "por vez"): passa para a próxima pessoa
create function public.task_completions_rotation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_rot public.task_rotations;
begin
  if tg_op = 'INSERT' then
    select * into v_rot from public.task_rotations where task_id = new.task_id and mode = 'turn' for update;
    if found then
      update public.task_rotations
      set current_index = public._rotation_step(v_rot, 1), last_completion = new.id, updated_at = now()
      where task_id = new.task_id;
      perform public._rotation_assign(new.task_id);
    end if;
  else
    -- Desfez a conclusão que passou a vez: a vez volta
    select * into v_rot from public.task_rotations where task_id = old.task_id and last_completion = old.id for update;
    if found then
      update public.task_rotations
      set current_index = public._rotation_step(v_rot, -1), last_completion = null, updated_at = now()
      where task_id = old.task_id;
      perform public._rotation_assign(old.task_id);
    end if;
  end if;
  return null;
end;
$$;
create trigger task_completions_rotation
  after insert or delete on public.task_completions
  for each row execute function public.task_completions_rotation();

-- Modo "por semana": na virada da semana (fuso da pasta), a vez passa
create function public.rotation_sweep()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rot public.task_rotations;
  v_week text;
  v_count integer := 0;
begin
  for v_rot in select * from public.task_rotations where mode = 'week' for update skip locked loop
    v_week := public._rotation_week(v_rot.folder_id);
    if v_rot.week_key is distinct from v_week then
      update public.task_rotations
      set current_index = case when v_rot.week_key is null then current_index
                               else public._rotation_step(v_rot, 1) end,
          week_key = v_week, updated_at = now()
      where task_id = v_rot.task_id;
      perform public._rotation_assign(v_rot.task_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.rotation_sweep(), public._rotation_assign(uuid),
  public._rotation_step(public.task_rotations, integer), public._rotation_active(uuid, uuid),
  public._rotation_week(uuid, timestamptz), public.task_completions_rotation(),
  public.tasks_rotation_folder()
  from public, anon, authenticated;
grant execute on function public.set_task_rotation(uuid, uuid[], text), public.rotation_pass(uuid, uuid),
  public.task_rotation_state(uuid) to authenticated;
revoke execute on function public.set_task_rotation(uuid, uuid[], text), public.rotation_pass(uuid, uuid),
  public.task_rotation_state(uuid) from public, anon;

select cron.schedule('questlist-rodizio', '10 * * * *', $$select public.rotation_sweep()$$);
