-- Funções (FN, ESCOPO_V16, D356): um processo chamável, com entradas e saídas. Publicar recusa a
-- chamada para o que não é função da pessoa ou não foi publicado, a recursão (direta ou indireta)
-- e a cadeia com mais de 5 níveis (V16-11). A função pura (só cálculo) roda em linha no executor.

create function public._process_check_calls(p_definition uuid, p_graph jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_owner uuid := (select owner_id from public.process_definitions where id = p_definition);
  v_ruim text;
  v_prof integer;
begin
  -- Toda função chamada é função da mesma pessoa e já tem versão publicada
  select n ->> 'funcao' into v_ruim from jsonb_array_elements(p_graph -> 'nos') n
  where n ->> 'tipo' in ('subprocesso', 'multi')
    and not exists (select 1 from public.process_definitions d
                    where d.id::text = n ->> 'funcao' and d.owner_id = v_owner and d.is_function
                      and exists (select 1 from public.process_versions v where v.definition_id = d.id))
  limit 1;
  if v_ruim is not null then
    perform public._process_fail('A função chamada não existe, não é sua ou ainda não foi publicada');
  end if;
  -- O grafo de chamadas (a última versão de cada função, e este rascunho no lugar da própria):
  -- recursão e a cadeia inteira, de quem chama este processo até a função mais funda
  with recursive chamadas(de, para) as (
    select v.definition_id, (n ->> 'funcao')::uuid
    from public.process_definitions d
    join lateral (select * from public.process_versions x where x.definition_id = d.id order by x.number desc limit 1) v on true
    cross join lateral jsonb_array_elements(v.graph -> 'nos') n
    where d.owner_id = v_owner and d.id <> p_definition and n ->> 'tipo' in ('subprocesso', 'multi')
      and n ->> 'funcao' ~ '^[0-9a-f-]{36}$'
    union
    select p_definition, (n ->> 'funcao')::uuid from jsonb_array_elements(p_graph -> 'nos') n
    where n ->> 'tipo' in ('subprocesso', 'multi') and n ->> 'funcao' ~ '^[0-9a-f-]{36}$'
  ), abaixo(no, prof, visto, volta) as (
    select p_definition, 0, array[p_definition], false
    union all
    select c.para, abaixo.prof + 1, abaixo.visto || c.para, c.para = any (abaixo.visto)
    from abaixo join chamadas c on c.de = abaixo.no
    where not abaixo.volta and abaixo.prof < 7
  ), acima(no, prof, visto) as (
    select p_definition, 0, array[p_definition]
    union all
    select c.de, acima.prof + 1, acima.visto || c.de from acima join chamadas c on c.para = acima.no
    where not c.de = any (acima.visto) and acima.prof < 7
  )
  select (select bool_or(volta) from abaixo)::int::text,
         coalesce((select max(prof) from abaixo where not volta), 0) + coalesce((select max(prof) from acima), 0)
  into v_ruim, v_prof;
  if v_ruim = '1' then
    perform public._process_fail('A função se chama (direta ou indiretamente): recursão não é permitida');
  end if;
  if v_prof > 5 then
    perform public._process_fail('No máximo 5 funções uma dentro da outra');
  end if;
end;
$$;

-- Publicar confere as chamadas
create or replace function public.process_publish(p_definition uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_def public.process_definitions;
  v_id uuid;
begin
  select * into v_def from public.process_definitions where id = p_definition and owner_id = auth.uid();
  if v_def.id is null then
    raise exception 'Processo não encontrado' using errcode = '42501';
  end if;
  perform public.process_validate(v_def.draft);
  perform public._process_check_calls(v_def.id, v_def.draft);
  insert into public.process_versions (definition_id, number, graph, signature)
  values (v_def.id,
          coalesce((select max(number) from public.process_versions where definition_id = v_def.id), 0) + 1,
          v_def.draft, v_def.draft -> 'assinatura')
  returning id into v_id;
  update public.process_definitions set
    start_trigger = (select n #>> '{gatilho,tipo}' from jsonb_array_elements(v_def.draft -> 'nos') n where n ->> 'tipo' = 'inicio'),
    updated_at = now()
  where id = v_def.id;
  return v_id;
end;
$$;

revoke execute on function public._process_check_calls(uuid, jsonb) from public, anon, authenticated;
