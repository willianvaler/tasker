-- AC9.4 (V6 §8, D242): superset e circuito. Itens da mesma página com a mesma letra formam um
-- grupo: o Modo Treino alterna entre eles e o descanso vem só no fim da rodada (lib/workout.ts).
alter table public.tasks add column superset text check (superset ~ '^[A-Z]$');
grant insert (superset), update (superset) on public.tasks to authenticated;
