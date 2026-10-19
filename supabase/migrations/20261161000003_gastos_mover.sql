-- ESCOPO_V9 (GA1): página de gastos movida de pasta ou projeto leva os lançamentos junto (a pasta
-- deles é a da página, como nas tarefas). Quem pagou e a tarefa ligada só são conferidos quando
-- mudam: mover para um projeto onde o pagador não está não pode travar a mudança; o pagador sai.
create or replace function public.expenses_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type text;
begin
  select p.folder_id, p.view_type::text into new.folder_id, v_type
  from public.pages p where p.id = new.page_id;
  if v_type is distinct from 'expenses' then
    raise exception 'Gastos só numa página de gastos' using errcode = '22023';
  end if;
  if new.task_id is not null and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id)
     and not exists (
       select 1 from public.tasks t
       where t.id = new.task_id and public.folder_root(t.folder_id) = public.folder_root(new.folder_id)
     ) then
    raise exception 'A tarefa ligada tem de ser do mesmo projeto' using errcode = '22023';
  end if;
  if new.paid_by is not null and (tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by)
     and not exists (
       select 1 from public.folder_members m
       where m.folder_id = public.folder_root(new.folder_id) and m.user_id = new.paid_by
     ) then
    raise exception 'Quem pagou tem de ser do projeto' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create function public.expenses_after_page_move()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.expenses e set
    folder_id = new.folder_id,
    -- Fora do projeto novo, quem pagou e a tarefa ligada deixam de valer
    paid_by = case when exists (select 1 from public.folder_members m
                                where m.folder_id = public.folder_root(new.folder_id)
                                  and m.user_id = e.paid_by) then e.paid_by end,
    task_id = case when exists (select 1 from public.tasks t
                                where t.id = e.task_id
                                  and public.folder_root(t.folder_id) = public.folder_root(new.folder_id))
                   then e.task_id end
  where e.page_id = new.id;
  return null;
end;
$$;

create trigger expenses_after_page_move
  after update of folder_id on public.pages
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.expenses_after_page_move();
