-- Fase 5: clã, boss cooperativo (de clã e de projeto), quadro de contribuição, exportar dados e
-- excluir conta (ESCOPO 4.6 e 9).
--
-- Boss de clã (semanal): dano = XP ganho pelos membros (o mesmo evento que bate no boss solo, D49).
-- Boss de projeto (com prazo): HP = tarefas principais do projeto; cada uma concluída é 1 de dano.
-- É calculado das próprias tarefas (status e completed_by), então desmarcar desfaz sem ledger (D50).
-- Recompensa: todos que contribuíram (≥ 1 de dano) ganham o XP; se o boss volta à vida, sai de todos.

-- ============================================================
-- Clãs
-- ============================================================

create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.clan_members (
  clan_id uuid not null references public.clans (id) on delete cascade,
  -- Um clã por pessoa (ESCOPO 4.6: "começar simples")
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

create table public.clan_invites (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '14 days',
  max_uses integer not null default 30 check (max_uses > 0),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index clan_invites_clan_id_idx on public.clan_invites (clan_id);

-- Feed do clã (sem chat). Não mostra títulos de tarefas: as pastas de cada um são particulares.
create table public.clan_activity (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('joined', 'left', 'boss_defeated', 'achievement')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index clan_activity_clan_id_created_at_idx on public.clan_activity (clan_id, created_at desc);

create function public.my_clan()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select clan_id from public.clan_members where user_id = auth.uid();
$$;

create function public._clan_log(p_clan_id uuid, p_user uuid, p_action text, p_payload jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.clan_activity (clan_id, user_id, action, payload)
  select p_clan_id, p_user, p_action, p_payload where p_clan_id is not null;
$$;

create function public.create_clan(p_name text, p_icon text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if public.my_clan() is not null then
    raise exception 'Você já está num clã. Saia dele antes de criar outro.' using errcode = '22023';
  end if;
  insert into public.clans (name, icon) values (trim(p_name), nullif(trim(p_icon), '')) returning id into v_id;
  insert into public.clan_members (clan_id, user_id, role) values (v_id, auth.uid(), 'owner');
  perform public._clan_log(v_id, auth.uid(), 'joined', '{}');
  return v_id;
end;
$$;

create function public.create_clan_invite()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_clan uuid := public.my_clan();
  v_token text;
begin
  if v_clan is null then
    raise exception 'Você não está num clã' using errcode = 'P0002';
  end if;
  select token into v_token from public.clan_invites
  where clan_id = v_clan and revoked_at is null and expires_at > now() + interval '1 day' and uses < max_uses
  order by created_at desc limit 1;
  if v_token is null then
    if (select count(*) from public.clan_invites where created_by = auth.uid()
        and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Muitos convites em pouco tempo. Tente de novo mais tarde.' using errcode = '54000';
    end if;
    insert into public.clan_invites (clan_id) values (v_clan) returning token into v_token;
  end if;
  return v_token;
end;
$$;

create function public.clan_invite_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_invite public.clan_invites;
  v_clan public.clans;
begin
  select * into v_invite from public.clan_invites where token = p_token;
  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'Convite inválido ou expirado');
  end if;
  select * into v_clan from public.clans where id = v_invite.clan_id;
  return jsonb_build_object(
    'valid', true, 'clan_id', v_clan.id, 'name', v_clan.name, 'icon', v_clan.icon,
    'members', (select count(*) from public.clan_members where clan_id = v_clan.id),
    'inviter', (select display_name from public.profiles where id = v_invite.created_by),
    'my_clan', public.my_clan()
  );
end;
$$;

create function public.join_clan(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.clan_invites;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar o convite' using errcode = '42501';
  end if;
  select * into v_invite from public.clan_invites where token = p_token for update;
  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses then
    raise exception 'Convite inválido ou expirado' using errcode = '22023';
  end if;
  if public.my_clan() = v_invite.clan_id then
    return v_invite.clan_id;
  end if;
  if public.my_clan() is not null then
    raise exception 'Você já está num clã. Saia dele antes de entrar em outro.' using errcode = '22023';
  end if;
  insert into public.clan_members (clan_id, user_id) values (v_invite.clan_id, auth.uid());
  update public.clan_invites set uses = uses + 1 where id = v_invite.id;
  perform public._clan_log(v_invite.clan_id, auth.uid(), 'joined', '{}');
  return v_invite.clan_id;
end;
$$;

-- Sair. O dono que sai passa o clã para o membro mais antigo; o último a sair apaga o clã.
create function public.leave_clan()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.clan_members;
begin
  select * into v_member from public.clan_members where user_id = auth.uid();
  if v_member.clan_id is null then
    raise exception 'Você não está num clã' using errcode = 'P0002';
  end if;
  delete from public.clan_members where user_id = auth.uid();
  if not exists (select 1 from public.clan_members where clan_id = v_member.clan_id) then
    delete from public.clans where id = v_member.clan_id;
    return;
  end if;
  if v_member.role = 'owner' then
    update public.clan_members set role = 'owner'
    where (clan_id, user_id) = (
      select clan_id, user_id from public.clan_members where clan_id = v_member.clan_id order by joined_at limit 1);
  end if;
  perform public._clan_log(v_member.clan_id, auth.uid(), 'left', '{}');
end;
$$;

-- ============================================================
-- Bosses cooperativos
-- ============================================================

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'task_completed', 'tasks_created', 'member_joined', 'comment_added', 'assignee_claimed',
  'boss_started', 'boss_defeated'));

-- Dano e recompensa agora por boss e pessoa (o mesmo evento bate no boss solo e no do clã)
alter table public.boss_damage drop constraint boss_damage_xp_event_id_key;
alter table public.boss_damage add constraint boss_damage_boss_event_key unique (boss_id, xp_event_id);
create index boss_damage_xp_event_id_idx on public.boss_damage (xp_event_id);
drop index public.xp_events_one_boss_reward;
create unique index xp_events_one_boss_reward on public.xp_events (boss_id, user_id)
  where not reverted and kind = 'boss_reward';

-- Projeto: quem pode ver o projeto vê o boss dele; clã: os membros
drop policy "bosses_select" on public.bosses;
create policy "bosses_select" on public.bosses for select to authenticated
  using ((scope = 'user' and scope_id = (select auth.uid()))
         or (scope = 'folder' and public.is_folder_member(scope_id))
         or (scope = 'clan' and scope_id = public.my_clan()));

-- Boss de clã da semana: HP escala com os membros ativos (com conclusão nas últimas 2 semanas)
create function public.ensure_clan_boss(p_clan_id uuid)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_key text;
  v_week_start date;
  v_boss public.bosses;
  v_rules jsonb := public.xp_rules() -> 'boss';
  v_active integer;
  v_level numeric;
  v_hp integer;
  v_names text[] := array['Titã da Preguiça', 'Leviatã dos Prazos', 'Colosso da Bagunça', 'Hidra das Reuniões',
                          'Dragão Ancião do Adiamento', 'Behemoth da Caixa de Entrada'];
  v_icons text[] := array['🗿', '🐋', '🏔️', '🐍', '🐲', '🦣'];
  v_pick integer;
begin
  if p_clan_id is null then
    return null;
  end if;
  select coalesce(p.timezone, 'America/Sao_Paulo') into v_tz
  from public.clans c left join public.profiles p on p.id = c.created_by where c.id = p_clan_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_key := to_char(now() at time zone v_tz, 'IYYY-"W"IW');
  select * into v_boss from public.bosses where scope = 'clan' and scope_id = p_clan_id and period_key = v_key;
  if v_boss.id is not null then
    return v_boss;
  end if;

  update public.bosses set status = 'escaped' where scope = 'clan' and scope_id = p_clan_id and status = 'active';

  select count(distinct m.user_id), coalesce(avg(p.level), 1) into v_active, v_level
  from public.clan_members m join public.profiles p on p.id = m.user_id
  where m.clan_id = p_clan_id and exists (
    select 1 from public.xp_events e where e.user_id = m.user_id and not e.reverted
      and e.kind in ('task', 'too_fast') and e.created_at > now() - interval '14 days');
  v_hp := greatest(1, v_active) * round((v_rules ->> 'minHp')::integer + (v_rules ->> 'hpPerLevel')::integer * v_level)::integer;

  v_week_start := date_trunc('week', now() at time zone v_tz)::date;
  v_pick := (extract(week from v_week_start)::integer % cardinality(v_names)) + 1;
  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, starts_at, ends_at)
  values ('clan', p_clan_id, v_names[v_pick], v_icons[v_pick], v_key, v_hp, v_hp,
          v_week_start::timestamp at time zone v_tz, (v_week_start + 7)::timestamp at time zone v_tz)
  on conflict (scope, scope_id, period_key) do nothing
  returning * into v_boss;
  if v_boss.id is null then
    select * into v_boss from public.bosses where scope = 'clan' and scope_id = p_clan_id and period_key = v_key;
  end if;
  return v_boss;
end;
$$;

-- Recompensa = quem contribuiu. Dá para quem falta, tira de quem deixou de contribuir (desmarcou).
-- Boss não derrotado: ninguém tem recompensa.
create function public._sync_boss_rewards(p_boss public.bosses)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipients uuid[];
  v_changed uuid[];
  v_user uuid;
begin
  if p_boss.status = 'defeated' then
    v_recipients := case p_boss.scope
      when 'user' then array[p_boss.scope_id]
      when 'clan' then (select array_agg(distinct user_id) from public.boss_damage where boss_id = p_boss.id)
      else (select array_agg(distinct t.completed_by) from public.tasks t
            where public.folder_root(t.folder_id) = p_boss.scope_id and t.parent_task_id is null
              and t.status = 'done' and t.completed_by is not null and t.completed_at >= p_boss.starts_at)
    end;
  end if;
  v_recipients := coalesce(v_recipients, '{}');

  with reverted as (
    update public.xp_events set reverted = true, reverted_at = now()
    where boss_id = p_boss.id and kind = 'boss_reward' and not reverted and not (user_id = any (v_recipients))
    returning user_id
  ), granted as (
    insert into public.xp_events (user_id, boss_id, kind, amount, day)
    select r, p_boss.id, 'boss_reward', (public.xp_rules() #>> '{boss,rewardXp}')::integer, public.user_today(r)
    from unnest(v_recipients) r
    where not exists (select 1 from public.xp_events e where e.boss_id = p_boss.id and e.user_id = r
                      and e.kind = 'boss_reward' and not e.reverted)
    returning user_id
  )
  select array_agg(user_id) into v_changed from (select user_id from reverted union select user_id from granted) u;

  -- O XP dos outros também muda: refaz o cache e confere conquistas de cada um
  foreach v_user in array coalesce(v_changed, '{}') loop
    perform public._refresh_profile_stats(v_user);
    perform public._check_achievements(v_user);
  end loop;
end;
$$;

-- Boss de projeto: HP = tarefas principais em aberto; o máximo acompanha as tarefas novas
create function public._settle_project_boss(p_boss_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
  v_total integer;
  v_open integer;
  v_defeated boolean := false;
begin
  select * into v_boss from public.bosses where id = p_boss_id for update;
  if v_boss.id is null or v_boss.status = 'escaped' or v_boss.ends_at <= now() then
    return false;
  end if;
  select count(*), count(*) filter (where status <> 'done') into v_total, v_open
  from public.tasks where public.folder_root(folder_id) = v_boss.scope_id and parent_task_id is null;

  update public.bosses set max_hp = greatest(1, v_total), hp = least(v_open, greatest(1, v_total))
  where id = p_boss_id returning * into v_boss;
  if v_open = 0 and v_total > 0 and v_boss.status = 'active' then
    update public.bosses set status = 'defeated', defeated_at = now() where id = p_boss_id returning * into v_boss;
    v_defeated := true;
    perform public._log_activity(v_boss.scope_id, 'boss_defeated', jsonb_build_object('name', v_boss.name));
  elsif v_open > 0 and v_boss.status = 'defeated' then
    update public.bosses set status = 'active', defeated_at = null where id = p_boss_id returning * into v_boss;
  end if;
  perform public._sync_boss_rewards(v_boss);
  return v_defeated;
end;
$$;

-- Solo e clã: HP pelo dano registrado (substitui a versão da Fase 3)
create or replace function public._settle_boss(p_boss_id uuid)
returns boolean -- true = derrotado agora
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
  v_damage integer;
  v_defeated boolean := false;
begin
  select * into v_boss from public.bosses where id = p_boss_id;
  if v_boss.scope = 'folder' then
    return public._settle_project_boss(p_boss_id);
  end if;
  select * into v_boss from public.bosses where id = p_boss_id for update;
  if v_boss.id is null or v_boss.status = 'escaped' then
    return false;
  end if;
  select coalesce(sum(amount), 0) into v_damage from public.boss_damage where boss_id = p_boss_id;
  update public.bosses set hp = greatest(0, max_hp - v_damage) where id = p_boss_id returning * into v_boss;

  if v_boss.hp = 0 and v_boss.status = 'active' then
    update public.bosses set status = 'defeated', defeated_at = now() where id = p_boss_id returning * into v_boss;
    v_defeated := true;
    if v_boss.scope = 'clan' then
      perform public._clan_log(v_boss.scope_id, auth.uid(), 'boss_defeated', jsonb_build_object('name', v_boss.name));
    end if;
  elsif v_boss.hp > 0 and v_boss.status = 'defeated' then
    -- Desmarcar tirou o golpe final: o boss volta e a recompensa sai
    update public.bosses set status = 'active', defeated_at = null where id = p_boss_id returning * into v_boss;
    if v_boss.scope = 'clan' then
      delete from public.clan_activity where clan_id = v_boss.scope_id and action = 'boss_defeated'
        and payload ->> 'name' = v_boss.name and created_at >= v_boss.starts_at;
    end if;
  end if;
  perform public._sync_boss_rewards(v_boss);
  return v_defeated;
end;
$$;

-- Dano: boss solo e, se a pessoa estiver num clã, o boss do clã (substitui a versão da Fase 3)
create or replace function public._grant_xp(
  p_user uuid, p_kind text, p_amount integer, p_quick boolean,
  p_task_id uuid, p_page_id uuid, p_completion_id uuid, p_cycle_key text,
  out event_id uuid, out boss_defeated boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
begin
  boss_defeated := false;
  insert into public.xp_events (user_id, task_id, page_id, completion_id, cycle_key, kind, amount, quick, day)
  values (p_user, p_task_id, p_page_id, p_completion_id, p_cycle_key, p_kind, p_amount, p_quick,
          public.user_today(p_user))
  on conflict do nothing
  returning id into event_id;

  if event_id is not null and p_amount > 0 then
    foreach v_boss in array array[
      public.ensure_weekly_boss(p_user),
      public.ensure_clan_boss((select clan_id from public.clan_members where user_id = p_user))
    ] loop
      -- Dano conta mesmo com o boss já derrotado: desmarcar uma tarefa antiga não o ressuscita
      -- se as conclusões seguintes cobrem o HP
      if v_boss.id is not null and v_boss.status <> 'escaped' then
        insert into public.boss_damage (boss_id, user_id, xp_event_id, amount)
        values (v_boss.id, p_user, event_id, p_amount);
        boss_defeated := public._settle_boss(v_boss.id) or boss_defeated;
      end if;
    end loop;
  end if;
end;
$$;

-- Conquista "primeiro boss" vale para qualquer boss (substitui a regra da Fase 3)
create or replace function public._check_achievements(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_done integer;
  v_keys text[] := '{}';
  v_new jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  select count(*) into v_done from public.xp_events
  where user_id = p_user and not reverted and kind in ('task', 'too_fast');

  if v_done >= 1 then v_keys := array_append(v_keys, 'first_task'); end if;
  if v_done >= 100 then v_keys := array_append(v_keys, 'tasks_100'); end if;
  if v_profile.streak_best >= 7 then v_keys := array_append(v_keys, 'streak_7'); end if;
  if v_profile.streak_best >= 30 then v_keys := array_append(v_keys, 'streak_30'); end if;
  if v_profile.streak_best >= 100 then v_keys := array_append(v_keys, 'streak_100'); end if;
  if v_profile.level >= 5 then v_keys := array_append(v_keys, 'level_5'); end if;
  if v_profile.level >= 10 then v_keys := array_append(v_keys, 'level_10'); end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'page_bonus') then
    v_keys := array_append(v_keys, 'page_complete');
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user and not reverted and kind = 'boss_reward') then
    v_keys := array_append(v_keys, 'first_boss');
  end if;
  if exists (select 1 from public.bosses b where b.scope = 'folder' and b.status = 'defeated'
             and public.folder_root(b.scope_id) in (select folder_id from public.folder_members where user_id = p_user)) then
    v_keys := array_append(v_keys, 'project_done');
  end if;

  with inserted as (
    insert into public.user_achievements (user_id, achievement_key)
    select p_user, k from unnest(v_keys) k
    on conflict do nothing
    returning achievement_key
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'icon', a.icon) order by a.position), '[]')
  into v_new
  from inserted i join public.achievements a on a.key = i.achievement_key;
  return v_new;
end;
$$;

insert into public.achievements (key, name, description, icon, position) values
  ('project_done', 'Missão cumprida', 'Derrotar o boss de um projeto antes do prazo', '🎯', 10);

-- Conquista nova aparece no feed do clã
create function public.user_achievements_clan_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._clan_log((select clan_id from public.clan_members where user_id = new.user_id), new.user_id,
    'achievement', (select jsonb_build_object('name', name, 'icon', icon) from public.achievements where key = new.achievement_key));
  return null;
end;
$$;

create trigger user_achievements_clan_log
  after insert on public.user_achievements
  for each row execute function public.user_achievements_clan_log();

-- Boss de projeto com prazo (ESCOPO 4.6): "o churrasco é sábado: derrote o boss até lá"
create function public.start_project_boss(p_folder_id uuid, p_deadline date)
returns public.bosses
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder public.folders;
  v_tz text;
  v_boss public.bosses;
  v_names text[] := array['Ogro da Organização', 'Golem da Lista', 'Grifo do Prazo', 'Basilisco dos Detalhes',
                          'Minotauro da Logística'];
  v_icons text[] := array['👹', '🗿', '🦅', '🦎', '🐂'];
  v_pick integer := 1 + floor(random() * 5)::integer;
begin
  select * into v_folder from public.folders where id = p_folder_id;
  if v_folder.id is null or not public.is_folder_member(p_folder_id, 'editor') then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  if v_folder.parent_id is not null or not v_folder.is_shared then
    raise exception 'Boss de projeto só em projeto (pasta raiz compartilhada)' using errcode = '22023';
  end if;
  v_tz := public.folder_timezone(p_folder_id);
  if p_deadline < (now() at time zone v_tz)::date then
    raise exception 'O prazo precisa ser hoje ou depois' using errcode = '22023';
  end if;
  if exists (select 1 from public.bosses where scope = 'folder' and scope_id = p_folder_id
             and status <> 'escaped' and ends_at > now()) then
    raise exception 'Este projeto já tem um boss' using errcode = '22023';
  end if;

  insert into public.bosses (scope, scope_id, name, icon, period_key, max_hp, hp, starts_at, ends_at)
  values ('folder', p_folder_id, v_names[v_pick], v_icons[v_pick], 'p:' || gen_random_uuid(), 1, 1, now(),
          (p_deadline + 1)::timestamp at time zone v_tz)
  returning * into v_boss;
  perform public._settle_project_boss(v_boss.id);
  select * into v_boss from public.bosses where id = v_boss.id;
  perform public._log_activity(p_folder_id, 'boss_started', jsonb_build_object(
    'name', v_boss.name, 'icon', v_boss.icon, 'deadline', p_deadline));
  return v_boss;
end;
$$;

-- Desistir do boss (ele foge; recompensa dada continua, só se ainda estava derrotado)
create function public.cancel_project_boss(p_folder_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_folder_member(p_folder_id, 'editor') then
    raise exception 'Pasta não encontrada' using errcode = 'P0002';
  end if;
  update public.bosses set status = 'escaped'
  where scope = 'folder' and scope_id = p_folder_id and status = 'active';
end;
$$;

-- Tarefa do projeto mudou (concluir, desfazer, criar, apagar, mover): recalcula o boss do projeto
create function public.tasks_project_boss()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_boss uuid;
begin
  for v_boss in
    select b.id from public.bosses b
    where b.scope = 'folder' and b.status <> 'escaped' and b.ends_at > now()
      and b.scope_id in (public.folder_root(case when tg_op = 'DELETE' then old.folder_id else new.folder_id end),
                         public.folder_root(case when tg_op = 'INSERT' then new.folder_id else old.folder_id end))
  loop
    perform public._settle_project_boss(v_boss);
  end loop;
  return null;
end;
$$;

create trigger tasks_project_boss
  after insert or delete or update of status, folder_id, parent_task_id on public.tasks
  for each row execute function public.tasks_project_boss();

-- Quadro de contribuição: dano por pessoa (o app mostra só destaques, sem "último lugar")
create function public.boss_board(p_boss_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_boss public.bosses;
begin
  select * into v_boss from public.bosses where id = p_boss_id;
  if v_boss.id is null or not (
       (v_boss.scope = 'user' and v_boss.scope_id = auth.uid())
    or (v_boss.scope = 'folder' and public.is_folder_member(v_boss.scope_id))
    or (v_boss.scope = 'clan' and v_boss.scope_id = public.my_clan())) then
    raise exception 'Boss não encontrado' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', d.user_id, 'name', p.display_name, 'damage', d.damage)
                     order by d.damage desc, p.display_name)
    from (
      select user_id, sum(amount)::integer as damage from public.boss_damage
      where boss_id = p_boss_id and v_boss.scope <> 'folder' group by user_id
      union all
      select completed_by, count(*)::integer from public.tasks
      where v_boss.scope = 'folder' and public.folder_root(folder_id) = v_boss.scope_id and parent_task_id is null
        and status = 'done' and completed_by is not null and completed_at >= v_boss.starts_at
      group by completed_by
    ) d join public.profiles p on p.id = d.user_id
  ), '[]');
end;
$$;

-- Estado do jogo, agora com o clã e o boss dele (substitui a versão da Fase 3)
create or replace function public.game_state()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_boss public.bosses;
  v_clan public.clans;
  v_clan_boss public.bosses;
  v_level record;
  v_streak record;
  v_today date;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  v_boss := public.ensure_weekly_boss(v_user);
  select * into v_clan from public.clans where id = public.my_clan();
  v_clan_boss := public.ensure_clan_boss(v_clan.id);
  -- A sequência muda com o tempo (o dia virou sem atividade), então o cache é refeito na leitura
  perform public._refresh_profile_stats(v_user);
  select * into v_profile from public.profiles where id = v_user;
  v_today := public.user_today(v_user);
  select * into v_level from public.level_for_xp(v_profile.xp);
  select * into v_streak from public.streak_stats(v_user, v_today);

  return jsonb_build_object(
    'enabled', v_profile.gamification_enabled,
    'xp', v_profile.xp,
    'level', v_level.level,
    'into_level', v_level.into_level,
    'for_next', v_level.for_next,
    'streak', v_streak.current_streak,
    'streak_best', v_streak.best_streak,
    'freeze_available', v_streak.freeze_available,
    'active_today', exists (select 1 from public.xp_events where user_id = v_user and day = v_today
                            and not reverted and kind in ('task', 'too_fast')),
    'xp_today', (select coalesce(sum(amount), 0) from public.xp_events
                 where user_id = v_user and day = v_today and not reverted),
    'tasks_done', (select count(*) from public.xp_events
                   where user_id = v_user and not reverted and kind in ('task', 'too_fast')),
    'boss', public._boss_json(v_boss),
    'clan', case when v_clan.id is null then null else jsonb_build_object(
      'id', v_clan.id, 'name', v_clan.name, 'icon', v_clan.icon,
      'members', (select count(*) from public.clan_members where clan_id = v_clan.id)) end,
    'clan_boss', public._boss_json(v_clan_boss),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', a.key, 'name', a.name, 'description', a.description, 'icon', a.icon,
        'unlocked_at', ua.unlocked_at) order by a.position), '[]')
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_key = a.key and ua.user_id = v_user
    )
  );
end;
$$;

create function public._boss_json(p_boss public.bosses)
returns jsonb
language sql stable set search_path = ''
as $$
  select case when p_boss.id is null then null else jsonb_build_object(
    'id', p_boss.id, 'name', p_boss.name, 'icon', p_boss.icon, 'max_hp', p_boss.max_hp, 'hp', p_boss.hp,
    'status', p_boss.status, 'ends_at', p_boss.ends_at, 'scope', p_boss.scope) end;
$$;

-- ============================================================
-- Privacidade (ESCOPO 9): exportar e excluir
-- ============================================================

-- Tudo o que é seu: perfil, pastas que você criou (com páginas e tarefas), histórico de XP,
-- conquistas, comentários que escreveu.
create function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c
                          where c.author_id = v_user), '[]')
  );
end;
$$;

-- Exclui a conta. Projetos com outras pessoas não somem: passam para o membro mais antigo.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_folder record;
begin
  if v_user is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  for v_folder in
    select f.id, (select m.user_id from public.folder_members m
                  where m.folder_id = f.id and m.user_id <> v_user
                  order by case m.role when 'editor' then 0 else 1 end, m.joined_at limit 1) as heir
    from public.folders f where f.owner_id = v_user and f.parent_id is null and not f.is_inbox
  loop
    if v_folder.heir is not null then
      update public.folders set owner_id = v_folder.heir where id = v_folder.id or parent_id = v_folder.id;
      update public.folder_members set role = 'owner' where folder_id = v_folder.id and user_id = v_folder.heir;
    end if;
  end loop;
  -- O que a pessoa criou ou recebeu em projetos dos outros fica com o projeto
  update public.tasks t set created_by = f.owner_id
  from public.folders f
  where f.id = public.folder_root(t.folder_id) and t.created_by = v_user and f.owner_id <> v_user;
  delete from public.task_assignees a
  where a.user_id = v_user and exists (
    select 1 from public.task_assignees b, public.profiles p
    where p.id = v_user and b.task_id = a.task_id and lower(b.pending_name) = lower(p.display_name));
  update public.task_assignees
  set user_id = null,
      pending_name = (select left(coalesce(nullif(trim(display_name), ''), 'Alguém'), 50)
                      from public.profiles where id = v_user)
  where user_id = v_user;

  if exists (select 1 from public.clan_members where user_id = v_user) then
    perform public.leave_clan();
  end if;
  delete from auth.users where id = v_user;
end;
$$;

-- ============================================================
-- RLS e permissões
-- ============================================================

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_invites enable row level security;
alter table public.clan_activity enable row level security;

revoke all on public.clans, public.clan_members, public.clan_invites, public.clan_activity from anon, authenticated;
grant select on public.clans, public.clan_members, public.clan_invites, public.clan_activity to authenticated;
grant update (name, icon) on public.clans to authenticated;

create policy "clans_select" on public.clans for select to authenticated using (id = public.my_clan());
create policy "clans_update" on public.clans for update to authenticated
  using (id = public.my_clan()) with check (id = public.my_clan());
create policy "clan_members_select" on public.clan_members for select to authenticated
  using (clan_id = public.my_clan());
create policy "clan_invites_select" on public.clan_invites for select to authenticated
  using (clan_id = public.my_clan());
create policy "clan_activity_select" on public.clan_activity for select to authenticated
  using (clan_id = public.my_clan());

-- Perfis: também os colegas de clã (para o nome no quadro e no feed)
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.folder_members mine
      join public.folder_members theirs on theirs.folder_id = mine.folder_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
    or exists (select 1 from public.clan_members c where c.user_id = profiles.id and c.clan_id = public.my_clan())
  );

revoke execute on function
  public._clan_log(uuid, uuid, text, jsonb), public.ensure_clan_boss(uuid), public._sync_boss_rewards(public.bosses),
  public._settle_project_boss(uuid), public.tasks_project_boss(), public.user_achievements_clan_log(),
  public._boss_json(public.bosses)
  from public, anon, authenticated;

revoke execute on function
  public.my_clan(), public.create_clan(text, text), public.create_clan_invite(), public.join_clan(text),
  public.leave_clan(), public.start_project_boss(uuid, date), public.cancel_project_boss(uuid),
  public.boss_board(uuid), public.export_my_data(), public.delete_my_account()
  from public, anon;
grant execute on function
  public.my_clan(), public.create_clan(text, text), public.create_clan_invite(), public.join_clan(text),
  public.leave_clan(), public.start_project_boss(uuid, date), public.cancel_project_boss(uuid),
  public.boss_board(uuid), public.export_my_data(), public.delete_my_account()
  to authenticated;
grant execute on function public.clan_invite_preview(text) to anon, authenticated;

alter publication supabase_realtime add table public.bosses, public.clan_activity, public.clan_members;
