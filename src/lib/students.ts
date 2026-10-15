import { parseWeight } from './workout';

// Painel "Alunos" (L5, D137): histórico por ciclo e evolução das cargas. Puro.

export type CheckLike = {
  id: string;
  task_id: string;
  title: string;
  cycle_key: string;
  done_at: string;
  note: string | null;
  values: { weight?: string | null; reps?: number | null }[] | null;
};

/** Conclusões agrupadas por ciclo (semana, dia...), do mais recente para o mais antigo. */
export function historyByCycle<T extends CheckLike>(checks: readonly T[]) {
  const groups = new Map<string, { cycle: string; first: string; items: T[] }>();
  for (const c of checks) {
    const g = groups.get(c.cycle_key) ?? { cycle: c.cycle_key, first: c.done_at, items: [] };
    g.items.push(c);
    if (c.done_at < g.first) g.first = c.done_at;
    groups.set(c.cycle_key, g);
  }
  return [...groups.values()].sort((a, b) => b.first.localeCompare(a.first));
}

/** Maior carga de cada exercício em cada ciclo, do mais antigo ao mais novo. */
export function loadEvolution(checks: readonly CheckLike[]) {
  const byTask = new Map<
    string,
    { title: string; points: { at: string; value: number; label: string }[] }
  >();
  for (const c of [...checks].sort((a, b) => a.done_at.localeCompare(b.done_at))) {
    let best: { value: number; label: string } | null = null;
    for (const v of c.values ?? []) {
      const w = parseWeight(v.weight);
      if (w && (!best || w.value > best.value)) best = { value: w.value, label: v.weight ?? '' };
    }
    if (!best) continue;
    const row = byTask.get(c.task_id) ?? { title: c.title, points: [] };
    row.points.push({ at: c.done_at, ...best });
    byTask.set(c.task_id, row);
  }
  return [...byTask.entries()].map(([taskId, row]) => ({ taskId, ...row }));
}

/** Dias desde a última atividade (null: nunca). */
export function daysSince(iso: string | null, now: number) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
}
