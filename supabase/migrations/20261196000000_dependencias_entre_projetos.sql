-- Dependências entre projetos (PC2, V3 §6 C, D307). Antes, uma tarefa só esperava outra do mesmo
-- projeto. Agora o pré-requisito pode estar em outro projeto (ou pasta) com a regra cruzada:
--   · ligar: a policy de sempre (dependency.manage no projeto da tarefa que espera) e, quando o
--     pré-requisito é de outro projeto, quem liga precisa ser de lá com papel de escrita (editor ou
--     dono). Leitor do outro projeto não expõe as tarefas dele;
--   · ver: quem é só do projeto que espera vê o título e o estado daquele pré-requisito (ligar é
--     mostrar essa tarefa), nunca o resto do outro projeto, pelo `cross_project_links`;
--   · o lado de lá vê "libera" com o título da tarefa que espera e o projeto só se for membro dele.
-- A ligação mora no projeto da tarefa que espera (folder_id, RLS e sync de sempre).

create or replace function public.task_dependencies_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_other public.tasks;
  v_path uuid[];
begin
  select * into v_task from public.tasks where id = new.task_id;
  select * into v_other from public.tasks where id = new.depends_on_task_id;
  if v_task.id is null or v_other.id is null then
    raise exception 'Tarefa não encontrada' using errcode = 'P0002';
  end if;
  -- Outro projeto: quem liga escreve lá (sem sessão, é o próprio servidor copiando)
  if public.folder_root(v_task.folder_id) <> public.folder_root(v_other.folder_id)
     and (tg_op = 'INSERT' or new.depends_on_task_id is distinct from old.depends_on_task_id)
     and auth.uid() is not null
     and not public.is_folder_member(v_other.folder_id, 'editor') then
    raise exception 'Para depender de uma tarefa de outro projeto, você precisa poder editar nele'
      using errcode = '42501';
  end if;
  new.folder_id := v_task.folder_id;

  -- Ciclo: a outra tarefa já depende (direta ou indiretamente) desta
  v_path := public.dependency_path(new.depends_on_task_id, new.task_id);
  if v_path is not null then
    raise exception 'Isso criaria um ciclo: %',
      (select string_agg(t.title, ' → ' order by u.n)
       from unnest(array[new.task_id] || v_path) with ordinality u(id, n)
       join public.tasks t on t.id = u.id)
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- As ligações de um projeto com os outros: os pré-requisitos de fora (estado para o cálculo de
-- bloqueada/pronta e o título) e as tarefas de fora que esperam uma deste projeto ("libera").
-- `project` só vem para quem é membro do outro projeto.
create function public.cross_project_links(p_root uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_folder_member(p_root) then
    raise exception 'Projeto não encontrado' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'prereqs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'status', o.status, 'completed_at', o.completed_at,
        'started_at', o.started_at, 'deps_mode', o.deps_mode,
        'project', case when public.is_folder_member(o.folder_id) then f.name end))
      from (
        select distinct d.depends_on_task_id as id
        from public.task_dependencies d
        join public.folders tf on tf.id = d.folder_id
        where coalesce(tf.parent_id, tf.id) = p_root
      ) x
      join public.tasks o on o.id = x.id
      join public.folders f on f.id = public.folder_root(o.folder_id)
      where f.id <> p_root
    ), '[]'::jsonb),
    'dependents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'task_id', d.task_id, 'depends_on_task_id', d.depends_on_task_id,
        'title', t.title, 'status', t.status,
        'project', case when public.is_folder_member(t.folder_id) then f.name end))
      from public.task_dependencies d
      join public.tasks o on o.id = d.depends_on_task_id
      join public.folders of_ on of_.id = o.folder_id
      join public.tasks t on t.id = d.task_id
      join public.folders f on f.id = public.folder_root(t.folder_id)
      where coalesce(of_.parent_id, of_.id) = p_root and f.id <> p_root
    ), '[]'::jsonb));
end;
$$;

revoke execute on function public.cross_project_links(uuid) from public, anon;
grant execute on function public.cross_project_links(uuid) to authenticated;
