-- GP2 (D314, ESCOPO_V12 §4): linha de base no Gantt. Guarda o começo e o fim de cada tarefa do
-- projeto num momento ("Plano aprovado 20/11"), para comparar depois: o que atrasou, quanto, o
-- que entrou e o que saiu. Até 5 por projeto. Os itens ficam num jsonb ([{t, s, e}]): uma linha
-- de base é uma foto, nunca editada.

create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 5000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index baselines_folder on public.baselines (folder_id, created_at);

alter table public.baselines enable row level security;
revoke all on public.baselines from anon;
revoke insert, update on public.baselines from authenticated;
-- Ver: quem é do projeto; apagar: quem mexe na estrutura; gravar só pelo save_baseline
create policy "baselines_select" on public.baselines for select to authenticated
  using (public.is_folder_member(folder_id));
create policy "baselines_delete" on public.baselines for delete to authenticated
  using (public.has_permission(folder_id, 'page.manage'));

-- Foto das datas: tarefas do projeto (pasta raiz e subpastas) com vencimento, fora as das reuniões
-- (GP1). Sem início, o começo é o vencimento, como a barra do Gantt.
create function public.save_baseline(p_root uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_root is null or (select parent_id from public.folders where id = p_root) is not null then
    raise exception 'Só na pasta raiz do projeto' using errcode = '22023';
  end if;
  if not public.has_permission(p_root, 'page.manage') then
    raise exception 'Seu cargo não salva linha de base aqui' using errcode = '42501';
  end if;
  if (select count(*) from public.baselines where folder_id = p_root) >= 5 then
    raise exception 'Até 5 linhas de base por projeto: apague uma antes' using errcode = '23514';
  end if;
  insert into public.baselines (folder_id, name, items)
  values (p_root, btrim(p_name), coalesce((
    select jsonb_agg(jsonb_build_object('t', t.id, 's', least(coalesce(t.start_date, t.due_date), t.due_date), 'e', t.due_date)
                     order by t.due_date, t.id)
    from public.tasks t join public.pages p on p.id = t.page_id
    where t.due_date is not null and p.view_type::text <> 'meeting'
      and t.folder_id in (select f.id from public.folders f where f.id = p_root or f.parent_id = p_root)
  ), '[]'))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.save_baseline(uuid, text) from public, anon;
grant execute on function public.save_baseline(uuid, text) to authenticated;

-- Projeto: entra no Realtime (quem salva aparece para os outros)
alter publication supabase_realtime add table public.baselines;
