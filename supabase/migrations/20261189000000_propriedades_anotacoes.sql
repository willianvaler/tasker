-- OB4 (ESCOPO_V11 §3, D289): propriedades e etiquetas nas anotações.
-- `props`: os campos da anotação (o frontmatter do Obsidian), um objeto JSON escrito pelo app;
-- `tags`: as etiquetas, calculadas aqui a partir do `#etiqueta` do texto e da propriedade `tags`
-- (o cliente não escreve). Espelho em src/lib/note-props.ts (noteTags), com os mesmos casos.

alter table public.notes
  add column props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 8192),
  add column tags text[] not null default '{}';
create index notes_tags on public.notes using gin (tags);
grant insert (props), update (props) on public.notes to authenticated;

-- Uma etiqueta limpa: sem "#", minúscula, sem "/" sobrando; precisa de uma letra (#2026 não é)
create function public._clean_tag(p_tag text)
returns text
language sql immutable set search_path = ''
as $$
  select case when t ~ '[[:alpha:]]' and char_length(t) <= 60 then t end
  from (
    select regexp_replace(trim(both '/' from regexp_replace(lower(ltrim(trim(p_tag), '#')), '/{2,}', '/', 'g')),
                          '\s+', '-', 'g') as t
  ) s;
$$;

/**
 * Etiquetas da anotação: os `#etiqueta` do texto (fora das cercas e dos trechos de código; o "#"
 * precisa vir no começo da linha ou depois de um espaço) e os itens da propriedade `tags` (lista ou
 * texto separado por vírgula). Na ordem em que aparecem, sem repetir, no máximo 100.
 */
create function public.note_tags(p_body text, p_props jsonb)
returns text[]
language plpgsql immutable set search_path = ''
as $$
declare
  v_out text[] := '{}';
  v_line text;
  v_fence boolean := false;
  v_tag text;
  v_item jsonb;
  v_m text[];
begin
  if p_props ? 'tags' then
    if jsonb_typeof(p_props -> 'tags') = 'array' then
      for v_item in select * from jsonb_array_elements(p_props -> 'tags') loop
        if jsonb_typeof(v_item) = 'string' then
          v_tag := public._clean_tag(v_item #>> '{}');
          if v_tag is not null and not v_tag = any (v_out) then
            v_out := v_out || v_tag;
          end if;
        end if;
      end loop;
    elsif jsonb_typeof(p_props -> 'tags') = 'string' then
      foreach v_tag in array string_to_array(p_props ->> 'tags', ',') loop
        v_tag := public._clean_tag(v_tag);
        if v_tag is not null and not v_tag = any (v_out) then
          v_out := v_out || v_tag;
        end if;
      end loop;
    end if;
  end if;
  if position('#' in coalesce(p_body, '')) = 0 then
    return v_out[1:100];
  end if;
  foreach v_line in array string_to_array(p_body, E'\n') loop
    if v_line ~ '^\s*```' then
      v_fence := not v_fence;
      continue;
    end if;
    if v_fence or position('#' in v_line) = 0 then
      continue;
    end if;
    v_line := regexp_replace(v_line, '`[^`]*`', ' ', 'g');
    for v_m in select regexp_matches(v_line, '(?:^|\s)#([[:alnum:]_/-]+)', 'g') loop
      v_tag := public._clean_tag(v_m[1]);
      if v_tag is not null and not v_tag = any (v_out) then
        v_out := v_out || v_tag;
      end if;
    end loop;
  end loop;
  return v_out[1:100];
end;
$$;

create function public.notes_tags()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.tags := public.note_tags(new.body, new.props);
  return new;
end;
$$;
create trigger notes_tags before insert or update of body, props on public.notes
  for each row execute function public.notes_tags();

-- As que já existem
update public.notes set tags = public.note_tags(body, props) where position('#' in body) > 0;
