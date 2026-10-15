-- Volta a descrição (tasks.notes) para 10.000 caracteres: o limite antigo era esse e o dono
-- prefere mantê-lo (desfaz a redução da W4).
alter table public.tasks drop constraint tasks_notes_check;
alter table public.tasks add constraint tasks_notes_check check (char_length(notes) <= 10000);
