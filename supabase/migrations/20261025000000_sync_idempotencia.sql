-- D3: as ações que viram RPC chegam pela fila do aparelho e podem ser reenviadas (a resposta se
-- perdeu, o app fechou no meio). Cada uma leva uma chave gerada no aparelho; a segunda chegada da
-- mesma chave não faz nada. Concluir uma recorrente duas vezes avançaria a data duas vezes.

create table public.applied_ops (
  user_id uuid not null references auth.users (id) on delete cascade,
  key uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.applied_ops enable row level security;
-- Sem policies: só o run_once (security definer) lê e grava
revoke all on public.applied_ops from anon, authenticated;

create function public.run_once(p_key uuid, p_name text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  insert into public.applied_ops (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  -- Se a ação falhar, a exceção desfaz também a chave: o reenvio tenta de novo
  case p_name
    when 'complete_task' then
      return public.complete_task((p_args ->> 'p_task_id')::uuid);
    when 'uncomplete_task' then
      return public.uncomplete_task((p_args ->> 'p_task_id')::uuid);
    when 'set_task_status' then
      return public.set_task_status((p_args ->> 'p_task_id')::uuid,
                                    (p_args ->> 'p_status')::public.task_status);
    when 'habit_tick' then
      return public.habit_tick((p_args ->> 'p_task_id')::uuid, (p_args ->> 'p_delta')::integer,
                               (p_args ->> 'p_id')::uuid);
    when 'undo_habit_tick' then
      return public.undo_habit_tick((p_args ->> 'p_event_id')::uuid);
    else
      raise exception 'Ação desconhecida: %', p_name using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.run_once(uuid, text, jsonb) from public, anon;
grant execute on function public.run_once(uuid, text, jsonb) to authenticated;

-- Chave velha não volta: a fila do aparelho não guarda nada por tanto tempo
select cron.schedule('questlist-applied-ops', '17 3 * * *',
  $$delete from public.applied_ops where created_at < now() - interval '30 days'$$);

-- Mais tabelas no banco local (D4): responsáveis, comentários, conclusões (sequência dos hábitos)
-- e perfis (o meu inteiro; dos outros, só nome e avatar)
alter publication powersync add table
  public.task_assignees,
  public.comments,
  public.task_completions,
  public.profiles;
