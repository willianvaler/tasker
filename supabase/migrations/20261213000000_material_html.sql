-- HTML interativo como material (ES5, ESCOPO_V13 §3, D326). O HTML com texto vira anotação no
-- aparelho (não passa por aqui); o que é quase só script (um simulador) fica guardado como está,
-- em "<pasta>/<id>.html". No Storage ele sobe como `application/octet-stream`: o endereço do arquivo
-- nunca abre como página (baixa), e o app o mostra num quadro isolado (sandbox sem mesma origem).

update storage.buckets set allowed_mime_types = array['application/pdf', 'application/octet-stream']
where id = 'materials';

alter table public.project_files drop constraint project_files_shape;
alter table public.project_files add constraint project_files_shape check (
  (kind = 'file' and path is not null and size is not null and note_id is null
   and mime in ('application/pdf', 'text/html'))
  or (kind = 'note' and note_id is not null and path is null and size is null));

create or replace function public.project_files_fill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'file' then
    -- O caminho é o da pasta ("<pasta>/<id>.pdf" ou ".html"), com a extensão do tipo
    if new.path <> (new.folder_id::text || '/' || new.id::text
                    || case new.mime when 'text/html' then '.html' else '.pdf' end) then
      raise exception 'Caminho do material não é o da pasta' using errcode = '22023';
    end if;
    if public._storage_used(new.created_by, new.id) + new.size > 1073741824 then
      raise exception 'Espaço de anexos cheio (1 GB)' using errcode = '22023';
    end if;
  elsif not exists (select 1 from public.notes n where n.id = new.note_id and n.folder_id = new.folder_id) then
    raise exception 'A anotação não é desta pasta' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.project_files_fill() from public, anon, authenticated;
