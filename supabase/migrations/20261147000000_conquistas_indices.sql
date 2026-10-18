-- V4 §2 (P2, D180): a conferência de conquistas roda a cada conclusão com XP. As contas por
-- pessoa (estimadas, delegadas, árvore) varriam a tabela de tarefas inteira (~30 ms cada com
-- 70 mil tarefas, no alpha com os dados reais); com estes índices, buscam só as da pessoa.
create index if not exists tasks_completed_by_done_idx on public.tasks (completed_by) where status = 'done';
create index if not exists tasks_created_by_idx on public.tasks (created_by);
