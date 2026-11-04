-- Gantt editável (PC3, V3 §6 C, D308): a tarefa ganha a data de início (`start_date`, sem hora,
-- como o `due_date`). A barra do Gantt vai do início ao vencimento; sem início, é o dia do
-- vencimento. Regras, num trigger para valer em qualquer caminho (app, sync, RPC):
--   · início depois do vencimento: o início vem para o dia do vencimento (o painel e o arrastar
--     já não deixam, mas mudar só o vencimento noutro lugar não pode dar erro);
--   · tarefa que se repete e avançou o vencimento (concluir leva para a próxima data) leva o
--     início junto, com a mesma duração;
--   · vencimento apagado leva o início junto (barra precisa do fim).

alter table public.tasks add column start_date date;
grant insert (start_date), update (start_date) on public.tasks to authenticated;

create function public.tasks_start_date_fit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.due_date is null then
    new.start_date := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.recurrence is not null
     and old.due_date is not null and old.start_date is not null
     and new.due_date is distinct from old.due_date
     and new.start_date is not distinct from old.start_date then
    new.start_date := old.start_date + (new.due_date - old.due_date);
  end if;
  if new.start_date > new.due_date then
    new.start_date := new.due_date;
  end if;
  return new;
end;
$$;

create trigger tasks_start_date_fit
  before insert or update of start_date, due_date on public.tasks
  for each row execute function public.tasks_start_date_fit();
