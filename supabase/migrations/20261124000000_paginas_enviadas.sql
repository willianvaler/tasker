-- V3 §3 (L1): página enviada. Quem tem `page.share` envia uma página para uma ou mais pessoas, ao
-- vivo (o destinatário vê a mesma página, com o progresso dele, e só executa: preset Executor) ou
-- como cópia (a página vira dele). O destinatário não é membro da pasta: lê a página e as tarefas
-- pelo envio e não vê mais nada do autor (pastas, outras páginas, outros alunos).

create table public.page_shares (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  -- Quem enviou
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Quem recebe; nulo enquanto é um convite por e-mail ainda sem conta/aceite
  recipient_id uuid references public.profiles (id) on delete cascade,
  recipient_email text check (recipient_email is null or recipient_email = lower(trim(recipient_email))),
  mode text not null default 'live' check (mode in ('live', 'copy')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'archived')),
  -- Cópia aceita: a página que nasceu para o destinatário
  copy_page_id uuid references public.pages (id) on delete set null,
  link_id uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_reminded_at timestamptz,
  check (recipient_id is not null or recipient_email is not null)
);
create unique index page_shares_one_per_person on public.page_shares (page_id, recipient_id)
  where recipient_id is not null and status in ('pending', 'active');
create unique index page_shares_one_per_email on public.page_shares (page_id, recipient_email)
  where recipient_id is null and status = 'pending';
create index page_shares_recipient on public.page_shares (recipient_id, status);
create index page_shares_page on public.page_shares (page_id);

-- Link de envio (WhatsApp etc.): cada pessoa que abre e aceita vira um envio
create table public.page_share_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'base64'),
  mode text not null default 'live' check (mode in ('live', 'copy')),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index page_share_links_page on public.page_share_links (page_id);
alter table public.page_shares add constraint page_shares_link_fk
  foreign key (link_id) references public.page_share_links (id) on delete set null;

-- Recebo esta página ao vivo (envio ativo)?
create function public.is_page_recipient(p_page_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.page_shares
    where page_id = p_page_id and recipient_id = (select auth.uid()) and status = 'active' and mode = 'live'
  );
$$;
grant execute on function public.is_page_recipient(uuid) to authenticated;

-- Quem gerencia os envios da página (o autor e quem tem page.share na pasta)
create function public.can_share_page(p_page_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pages p
    where p.id = p_page_id and not p.is_inbox and not p.is_habits
      and public.has_permission(p.folder_id, 'page.share')
  );
$$;
grant execute on function public.can_share_page(uuid) to authenticated;

-- E-mail de quem está logado (o papel authenticated não lê auth.users)
create function public.my_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(email) from auth.users where id = (select auth.uid());
$$;
grant execute on function public.my_email() to authenticated;

alter table public.page_shares enable row level security;
alter table public.page_share_links enable row level security;

-- O destinatário vê o envio dele (e o convite pendente para o e-mail dele); quem gerencia, todos
create policy "page_shares: meus e da página" on public.page_shares
  for select to authenticated using (
    recipient_id = (select auth.uid())
    or (recipient_id is null and status = 'pending'
        and recipient_email = public.my_email())
    or public.can_share_page(page_id)
  );
create policy "page_share_links: quem gerencia" on public.page_share_links
  for select to authenticated using (public.can_share_page(page_id));
revoke insert, update, delete on public.page_shares, public.page_share_links from anon, authenticated;

-- O destinatário ao vivo lê a página e as tarefas dela (só leitura: as policies de escrita e os
-- guardas continuam pedindo cargo na pasta)
create policy "pages_select_recebida" on public.pages for select to authenticated
  using (public.is_page_recipient(id));
create policy "tasks_select_recebida" on public.tasks for select to authenticated
  using (public.is_page_recipient(page_id));

alter publication powersync add table public.page_shares;
