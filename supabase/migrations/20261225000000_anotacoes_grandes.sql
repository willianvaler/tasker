-- Anotações maiores (ED1, ESCOPO_V16, V16-18, D345): o teto do texto sobe de 20 mil para 1 milhão de
-- caracteres (cerca de 1 MB), e os links guardados por texto, de 300 para 2 mil.

alter table public.notes drop constraint notes_body_check;
alter table public.notes add constraint notes_body_check check (char_length(body) <= 1000000);

create or replace function public._refresh_links(p_kind text, p_id uuid, p_user uuid, p_folder uuid, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_line text;
  v_m text[];
  v_pos int := 0;
  v_ref text;
  v_kind text;
  v_id uuid;
begin
  delete from public.links where source_kind = p_kind and source_id = p_id;
  if p_text is null or position('[[' in p_text) = 0 then
    return;
  end if;
  <<lines>>
  foreach v_line in array string_to_array(p_text, E'\n') loop
    continue when position('[[' in v_line) = 0;
    for v_m in
      select regexp_matches(v_line, '(!?)\[\[([^\[\]|#\n]+)(?:#([^\[\]|\n]+))?(?:\|([^\[\]\n]*))?\]\]', 'g')
    loop
      continue when trim(v_m[2]) = '';
      v_pos := v_pos + 1;
      -- Anotação de até 1 milhão de caracteres (ED1): até 2 mil links
      exit lines when v_pos > 2000;
      v_ref := trim(coalesce(v_m[4], ''));
      v_kind := null;
      v_id := null;
      if v_ref ~ '^[ntpf]:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        v_kind := case left(v_ref, 1)
          when 'n' then 'note' when 't' then 'task' when 'p' then 'page' else 'folder' end;
        v_id := substr(v_ref, 3)::uuid;
      end if;
      insert into public.links (source_kind, source_id, user_id, folder_id, target_kind, target_id,
                                target_title, anchor, embed, context, position)
      values (p_kind, p_id, p_user, p_folder, v_kind, v_id, left(trim(v_m[2]), 200),
              left(nullif(trim(coalesce(v_m[3], '')), ''), 200), v_m[1] = '!',
              public._link_context(v_line), v_pos);
    end loop;
  end loop;
end;
$$;
