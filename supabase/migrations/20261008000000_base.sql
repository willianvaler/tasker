-- Fase 0: núcleo do modelo (perfis, pastas, membros, páginas, tarefas) e RLS base.
-- Tabelas das fases seguintes (convites, responsáveis, gamificação...) entram nas migrações delas.

-- ============================================================
-- Tipos
-- ============================================================

create type public.folder_role as enum ('owner', 'editor', 'viewer');
create type public.page_view_type as enum ('list', 'cards', 'habits', 'kanban');
create type public.page_reset_cycle as enum ('none', 'daily', 'weekly', 'manual');
create type public.task_status as enum ('todo', 'doing', 'done');

-- ============================================================
-- Tabelas
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  avatar_url text,
  timezone text not null default 'America/Sao_Paulo',
  gamification_enabled boolean not null default true,
  -- Cache do ledger de XP (Fase 3); só funções do servidor alteram
  xp integer not null default 0,
  level integer not null default 1,
  coins integer not null default 0,
  streak integer not null default 0,
  streak_best integer not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Subpasta: no máximo 1 nível (garantido por trigger). Os membros são os da pasta raiz.
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  icon text,
  color text,
  is_shared boolean not null default false,
  -- Pasta de sistema que guarda a Caixa de entrada; criada no cadastro, não pode ser apagada
  is_inbox boolean not null default false,
  position double precision not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index folders_one_inbox_per_owner on public.folders (owner_id) where is_inbox;
create index folders_parent_id_idx on public.folders (parent_id);

create table public.folder_members (
  folder_id uuid not null references public.folders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.folder_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
create index folder_members_user_id_idx on public.folder_members (user_id);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  icon text,
  view_type public.page_view_type not null default 'list',
  reset_cycle public.page_reset_cycle not null default 'none',
  is_inbox boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index pages_folder_id_idx on public.pages (folder_id);
create unique index pages_one_inbox_per_folder on public.pages (folder_id) where is_inbox;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  -- Desnormalizado (= pasta da página), mantido por trigger: o cliente nunca envia
  folder_id uuid not null references public.folders (id) on delete cascade,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 500),
  notes text check (char_length(notes) <= 10000),
  status public.task_status not null default 'todo',
  priority smallint not null default 0 check (priority between 0 and 3),
  due_at timestamptz,
  recurrence jsonb,
  position double precision not null default 0,
  meta jsonb,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_page_id_position_idx on public.tasks (page_id, position);
create index tasks_folder_id_idx on public.tasks (folder_id);
create index tasks_parent_task_id_idx on public.tasks (parent_task_id);
create index tasks_due_at_idx on public.tasks (due_at) where status <> 'done';

-- ============================================================
-- Permissões por papel
-- ============================================================

-- Pasta raiz de uma pasta (ela mesma ou a mãe). Os membros ficam sempre na raiz.
create function public.folder_root(p_folder_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(f.parent_id, f.id) from public.folders f where f.id = p_folder_id;
$$;

-- O usuário atual é membro da pasta com pelo menos esse papel? (owner > editor > viewer)
-- security definer para as policies não recursarem na RLS de folder_members.
create function public.is_folder_member(p_folder_id uuid, p_min_role public.folder_role default 'viewer')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.folder_members m
    where m.folder_id = public.folder_root(p_folder_id)
      and m.user_id = auth.uid()
      and case m.role when 'owner' then 3 when 'editor' then 2 else 1 end
          >= case p_min_role when 'owner' then 3 when 'editor' then 2 else 1 end
  );
$$;

-- ============================================================
-- Triggers
-- ============================================================

-- Cadastro: cria o perfil e a Caixa de entrada (pasta de sistema + página)
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 50)
  );

  insert into public.folders (owner_id, name, icon, is_inbox)
  values (new.id, 'Caixa de entrada', '📥', true)
  returning id into v_folder_id;

  insert into public.pages (folder_id, name, icon, is_inbox)
  values (v_folder_id, 'Caixa de entrada', '📥', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pasta nova: valida a profundidade e coloca o dono como membro (só nas raízes)
create function public.folders_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.folders p where p.id = new.parent_id and (p.parent_id is not null or p.is_inbox)) then
      raise exception 'Subpasta só pode ficar em uma pasta raiz que não seja a Caixa de entrada';
    end if;
    if new.is_inbox then
      raise exception 'A Caixa de entrada não pode ser subpasta';
    end if;
  end if;
  return new;
end;
$$;

create trigger folders_before_write
  before insert or update of parent_id on public.folders
  for each row execute function public.folders_before_write();

create function public.folders_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_id is null then
    insert into public.folder_members (folder_id, user_id, role) values (new.id, new.owner_id, 'owner');
  end if;
  return new;
end;
$$;

create trigger folders_after_insert
  after insert on public.folders
  for each row execute function public.folders_after_insert();

-- Tarefa: folder_id sempre vem da página; subtarefa fica na mesma página da mãe
create function public.tasks_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception 'Uma tarefa não pode ser subtarefa dela mesma';
    end if;
    if exists (select 1 from public.tasks t where t.id = new.parent_task_id and t.parent_task_id is not null) then
      raise exception 'Subtarefa não pode ter subtarefas';
    end if;
    select t.page_id into new.page_id from public.tasks t where t.id = new.parent_task_id;
    if new.page_id is null then
      raise exception 'Tarefa mãe não encontrada';
    end if;
  end if;

  select p.folder_id into new.folder_id from public.pages p where p.id = new.page_id;
  if new.folder_id is null then
    raise exception 'Página não encontrada';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Tarefa movida de página: as subtarefas vão junto
create function public.tasks_after_move()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.tasks set page_id = new.page_id where parent_task_id = new.id and page_id <> new.page_id;
  return null;
end;
$$;

create trigger tasks_after_move
  after update of page_id on public.tasks
  for each row when (old.page_id is distinct from new.page_id)
  execute function public.tasks_after_move();

-- Página movida de pasta: atualiza o folder_id das tarefas
create function public.pages_after_move()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.tasks set folder_id = new.folder_id where page_id = new.id;
  return null;
end;
$$;

create trigger pages_after_move
  after update of folder_id on public.pages
  for each row when (old.folder_id is distinct from new.folder_id)
  execute function public.pages_after_move();

-- A Caixa de entrada não sai da pasta dela (is_inbox nem é gravável pelo cliente)
create function public.pages_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.is_inbox and new.folder_id <> old.folder_id then
    raise exception 'A Caixa de entrada não pode ser movida';
  end if;
  return new;
end;
$$;

create trigger pages_before_update
  before update of folder_id on public.pages
  for each row execute function public.pages_before_write();

-- ============================================================
-- Privilégios por coluna
-- O cliente (authenticated) só escreve as colunas listadas. O resto é do servidor:
-- folder_id das tarefas (trigger), status/conclusão (RPCs da Fase 1), XP e afins (Fase 3).
-- O id pode vir do cliente para a atualização otimista.
-- ============================================================

revoke insert, update on public.profiles, public.folders, public.folder_members, public.pages, public.tasks
  from anon, authenticated;
revoke all on public.profiles, public.folders, public.folder_members, public.pages, public.tasks from anon;

grant update (display_name, avatar_url, timezone, gamification_enabled) on public.profiles to authenticated;

grant insert (id, parent_id, name, icon, color, position) on public.folders to authenticated;
grant update (name, icon, color, position, archived) on public.folders to authenticated;

grant insert (id, folder_id, name, icon, view_type, reset_cycle, position) on public.pages to authenticated;
grant update (folder_id, name, icon, view_type, reset_cycle, position) on public.pages to authenticated;

grant insert (id, page_id, parent_task_id, title, notes, priority, due_at, recurrence, position, meta)
  on public.tasks to authenticated;
grant update (page_id, parent_task_id, title, notes, priority, due_at, recurrence, position, meta)
  on public.tasks to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.folder_members enable row level security;
alter table public.pages enable row level security;
alter table public.tasks enable row level security;

-- Perfis: o próprio e os de quem divide alguma pasta com você
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.folder_members mine
      join public.folder_members theirs on theirs.folder_id = mine.folder_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Pastas. O owner_id = auth.uid() no select cobre o insert ... returning (antes do trigger criar o membro).
create policy "folders_select" on public.folders for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_folder_member(id));
create policy "folders_insert" on public.folders for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (parent_id is null or public.is_folder_member(parent_id, 'editor'))
  );
create policy "folders_update" on public.folders for update to authenticated
  using (public.is_folder_member(id, 'editor')) with check (public.is_folder_member(id, 'editor'));
create policy "folders_delete" on public.folders for delete to authenticated
  using (not is_inbox and public.is_folder_member(id, 'owner'));

-- Membros: leitura para quem é da pasta; entrada e saída vêm por RPC (Fase 4)
create policy "folder_members_select" on public.folder_members for select to authenticated
  using (public.is_folder_member(folder_id));

-- Páginas
create policy "pages_select" on public.pages for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "pages_insert" on public.pages for insert to authenticated
  with check (public.is_folder_member(folder_id, 'editor'));
create policy "pages_update" on public.pages for update to authenticated
  using (public.is_folder_member(folder_id, 'editor')) with check (public.is_folder_member(folder_id, 'editor'));
create policy "pages_delete" on public.pages for delete to authenticated
  using (not is_inbox and public.is_folder_member(folder_id, 'editor'));

-- Tarefas (o with check vê o folder_id já preenchido pelo trigger)
create policy "tasks_select" on public.tasks for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (public.is_folder_member(folder_id, 'editor') and created_by = (select auth.uid()));
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.is_folder_member(folder_id, 'editor')) with check (public.is_folder_member(folder_id, 'editor'));
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.is_folder_member(folder_id, 'editor'));

-- ============================================================
-- Realtime (Fase 4 usa; já deixa publicado)
-- ============================================================

alter publication supabase_realtime add table public.tasks, public.pages, public.folders;
