-- Peso da tarefa com seis níveis nomeados (pedido do dono em 20/10, D226): Trivial (1), Baixo (2),
-- Médio (3), Alto (4), Muito alto (5), Extremo (6). O fator do golpe segue 1 + 0,25 × (peso − 1):
-- Extremo = 2,25×. Vazio continua valendo 1.
alter table public.tasks drop constraint tasks_weight_check;
alter table public.tasks add constraint tasks_weight_check check (weight between 1 and 6);
