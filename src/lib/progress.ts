// Progresso do projeto (ESCOPO 4.5): geral e por pessoa. Função pura, com teste.

export type Progress = { done: number; total: number };

/** Progresso geral e por pessoa (ESCOPO 4.5). Pendentes contam pelo nome. */
export function projectProgress(
  tasks: { id: string; status: string }[],
  assignees: { task_id: string; user_id: string | null; pending_name: string | null }[],
): { overall: Progress; byUser: Map<string, Progress>; byPending: Map<string, Progress> } {
  const status = new Map(tasks.map((t) => [t.id, t.status]));
  const overall = { done: tasks.filter((t) => t.status === 'done').length, total: tasks.length };
  const byUser = new Map<string, Progress>();
  const byPending = new Map<string, Progress>();
  for (const a of assignees) {
    const st = status.get(a.task_id);
    if (!st) continue;
    const map = a.user_id ? byUser : byPending;
    const key = a.user_id ?? (a.pending_name ?? '').toLowerCase();
    const p = map.get(key) ?? { done: 0, total: 0 };
    map.set(key, { done: p.done + (st === 'done' ? 1 : 0), total: p.total + 1 });
  }
  return { overall, byUser, byPending };
}
