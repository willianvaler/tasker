// Árvore de subtarefas (V3 §1): a mãe é pacote e o progresso dela é o das folhas do galho inteiro.

type Node = { id: string; parent_task_id: string | null; status: string };
export type LeafProgress = { done: number; total: number };

/** Para cada tarefa com subtarefas: quantas folhas do galho estão concluídas e quantas existem. */
export function leafProgress(tasks: readonly Node[]): Map<string, LeafProgress> {
  const children = new Map<string, Node[]>();
  for (const t of tasks) {
    if (!t.parent_task_id) continue;
    const list = children.get(t.parent_task_id) ?? [];
    list.push(t);
    children.set(t.parent_task_id, list);
  }
  const result = new Map<string, LeafProgress>();
  const visit = (task: Node, seen: Set<string>): LeafProgress => {
    const kids = children.get(task.id);
    if (!kids?.length) return { done: task.status === 'done' ? 1 : 0, total: 1 };
    const cached = result.get(task.id);
    if (cached) return cached;
    const sum = { done: 0, total: 0 };
    for (const kid of kids) {
      // Defesa contra ciclo em dado local ainda não confirmado (o servidor recusa ciclo)
      if (seen.has(kid.id)) continue;
      const p = visit(kid, new Set(seen).add(kid.id));
      sum.done += p.done;
      sum.total += p.total;
    }
    result.set(task.id, sum);
    return sum;
  };
  for (const t of tasks) if (children.has(t.id)) visit(t, new Set([t.id]));
  return result;
}
