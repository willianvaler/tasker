-- V2 §4.2: cargos no projeto. Os valores entram numa migração própria porque o Postgres não deixa
-- usar um valor novo de enum na mesma transação em que ele foi criado.
alter type public.folder_role add value if not exists 'manager' after 'owner';
alter type public.folder_role add value if not exists 'contributor' after 'editor';
