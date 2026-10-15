-- W4: a descrição da tarefa (coluna `notes`) vai até 4.000 caracteres (era 10.000; o maior texto
-- guardado hoje tem bem menos).
alter table public.tasks drop constraint tasks_notes_check;
alter table public.tasks add constraint tasks_notes_check check (char_length(notes) <= 4000);
