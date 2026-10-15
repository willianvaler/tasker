-- V3 §6 (M4): "Meu dia". Cada pessoa escolhe, para um dia, as tarefas que vai fazer, em ordem.
-- É dela (não muda a tarefa): escrita direta com RLS, também offline pelo sync.
create table public.my_day (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  day date not null,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, day)
);
create index my_day_user_day on public.my_day (user_id, day);

alter table public.my_day enable row level security;
create policy "my_day: o meu" on public.my_day for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.tasks t where t.id = task_id));
revoke insert, update on public.my_day from anon, authenticated;
grant insert (id, task_id, day, position), update (position) on public.my_day to authenticated;
alter publication powersync add table public.my_day;
