-- V3 §1.2 (G3): subtarefa herda etiquetas e responsáveis da mãe (editável depois); estimativa em
-- minutos, com a da mãe sendo a soma das folhas (só leitura, calculada na tela).

alter table public.tasks add column estimate_minutes integer
  check (estimate_minutes is null or estimate_minutes between 1 and 60000);
grant insert (estimate_minutes), update (estimate_minutes) on public.tasks to authenticated;

-- Etiquetas: subtarefa criada sem nenhuma recebe as da mãe
create function public.tasks_inherit_labels()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.parent_task_id is not null and coalesce(cardinality(new.labels), 0) = 0 then
    select labels into new.labels from public.tasks where id = new.parent_task_id;
    new.labels := coalesce(new.labels, '{}');
  end if;
  return new;
end;
$$;

create trigger tasks_inherit_labels
  before insert on public.tasks
  for each row execute function public.tasks_inherit_labels();

-- Responsáveis: no fim da transação, subtarefa nova que ficou sem nenhum recebe os da mãe
-- (adiado: o lote grava a tarefa antes dos responsáveis dela)
create function public.tasks_inherit_assignees()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_task_id is null
     or not exists (select 1 from public.tasks where id = new.id)
     or exists (select 1 from public.task_assignees where task_id = new.id) then
    return null;
  end if;
  insert into public.task_assignees (task_id, user_id, pending_name)
  select new.id, a.user_id, a.pending_name from public.task_assignees a where a.task_id = new.parent_task_id;
  return null;
end;
$$;

create constraint trigger tasks_inherit_assignees
  after insert on public.tasks
  deferrable initially deferred
  for each row execute function public.tasks_inherit_assignees();
