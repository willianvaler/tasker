-- PB2 (V3 §6 B, D222): reações nas tarefas concluídas e nos comentários do projeto.
-- Uma lista fixa de emojis; cada pessoa liga ou desliga a sua. Quem pode comentar pode reagir
-- (o Leitor também, D44). Quem recebeu a reação (quem concluiu ou quem comentou) ganha um aviso.

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,  -- do trigger (o cliente não envia)
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '🔥', '💪', '❤️', '🎉')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (task_id, comment_id, user_id, emoji)
);
create index reactions_task_id_idx on public.reactions (task_id);
create index reactions_folder_id_idx on public.reactions (folder_id);
create index reactions_comment_id_idx on public.reactions (comment_id) where comment_id is not null;

alter table public.reactions enable row level security;
revoke insert, update, delete on public.reactions from anon, authenticated;
grant insert (task_id, comment_id, emoji) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

-- folder_id vem da tarefa; o comentário tem de ser da tarefa; na tarefa, só concluída
create function public.reactions_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada' using errcode = '23503';
  end if;
  if new.comment_id is not null then
    if not exists (select 1 from public.comments where id = new.comment_id and task_id = new.task_id) then
      raise exception 'O comentário não é desta tarefa' using errcode = '23503';
    end if;
  elsif v_task.status <> 'done' then
    raise exception 'Só dá para reagir a uma tarefa concluída' using errcode = '22023';
  end if;
  new.folder_id := v_task.folder_id;
  new.user_id := auth.uid();
  return new;
end;
$$;
create trigger reactions_before_insert
  before insert on public.reactions
  for each row execute function public.reactions_before_insert();

-- Aviso para quem concluiu (ou quem comentou); um só enquanto o anterior da mesma pessoa não foi lido
create function public.reactions_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_to uuid;
  v_title text;
begin
  select title, completed_by into v_title, v_to from public.tasks where id = new.task_id;
  if new.comment_id is not null then
    select author_id into v_to from public.comments where id = new.comment_id;
  end if;
  if v_to is null or exists (
    select 1 from public.notifications n
    where n.user_id = v_to and n.kind = 'reaction' and n.read_at is null
      and n.payload ->> 'task_id' = new.task_id::text
      and n.payload ->> 'reactor_id' = new.user_id::text
      and (n.payload ->> 'comment_id') is not distinct from new.comment_id::text
  ) then
    return null;
  end if;
  perform public._notify(v_to, 'reaction', jsonb_build_object(
    'task_id', new.task_id, 'comment_id', new.comment_id, 'title', v_title,
    'emoji', new.emoji, 'reactor_id', new.user_id));
  return null;
end;
$$;
create trigger reactions_after_insert
  after insert on public.reactions
  for each row execute function public.reactions_after_insert();

create policy "reactions_select" on public.reactions for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "reactions_insert" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_permission(folder_id, 'comment.create'));
create policy "reactions_delete" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.reactions;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'assigned', 'mention', 'member_joined', 'team_invited', 'team_joined', 'join_requested', 'join_approved',
  'task_ready', 'prereq_reopened', 'page_reminder', 'automation', 'workout_invite', 'challenge_started',
  'task_reminder', 'reaction'));

-- Exportar meus dados (LGPD): as reações que fiz entram junto
create or replace function public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_user),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.folders f
                         where f.owner_id = v_user), '[]'),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.pages p
                       join public.folders f on f.id = p.folder_id where f.owner_id = v_user), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                        order by t.created_at)
                       from public.tasks t join public.pages p on p.id = t.page_id join public.folders f on f.id = p.folder_id
                       where f.owner_id = v_user or t.created_by = v_user), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(c) order by c.completed_at) from public.task_completions c
                             where c.user_id = v_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e
                           where e.user_id = v_user), '[]'),
    'achievements', coalesce((select jsonb_agg(to_jsonb(a)) from public.user_achievements a
                              where a.user_id = v_user), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.acquired_at) from public.user_items i
                       where i.user_id = v_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' - 'folder_id' order by r.created_at)
                           from public.reactions r where r.user_id = v_user), '[]'),
    -- V9: lançamentos de gasto feitos pela pessoa (ou em pastas dela) e leituras de foto
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) - 'folder_id' || jsonb_build_object('page', p.name, 'folder', f.name)
                                           order by e.spent_on, e.created_at)
                          from public.expenses e join public.pages p on p.id = e.page_id join public.folders f on f.id = p.folder_id
                          where f.owner_id = v_user or e.created_by = v_user), '[]'),
    'photo_reads', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.photo_reads r
                             where r.user_id = v_user), '[]'),
    -- V5 §4: o que foi aceito e os pedidos feitos também são dados da pessoa
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.accepted_at) from public.consents c
                          where c.user_id = v_user), '[]'),
    'data_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at) from public.data_requests r
                               where r.user_id = v_user), '[]')
  );
end;
$function$;
