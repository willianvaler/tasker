-- AC3.10 (D247, D274): fotos dos exercícios da free-exercise-db (Unlicense), servidas por nós. Bucket
-- público só de leitura: as fotos são do catálogo, iguais para todos, e não têm dado de ninguém.
-- Ninguém do app grava (sem policy de escrita em storage.objects); quem sobe é o
-- scripts/exercicios/fotos.mjs, com a chave de serviço. Caminhos: <id do catálogo>/0.jpg e 1.jpg
-- (480 px) e mini/<id>/0.jpg e 1.jpg (160 px).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-photos', 'exercise-photos', true, 512000, array['image/jpeg', 'text/plain'])
on conflict (id) do nothing;
