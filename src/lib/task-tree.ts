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

type EstimateNode = Node & { estimate_minutes: number | null };

/** Estimativa de cada mãe = soma das estimativas das folhas do galho (só as que têm valor). */
export function leafEstimates(tasks: readonly EstimateNode[]): Map<string, number> {
  const byParent = new Map<string, EstimateNode[]>();
  for (const t of tasks) {
    if (!t.parent_task_id) continue;
    byParent.set(t.parent_task_id, [...(byParent.get(t.parent_task_id) ?? []), t]);
  }
  const result = new Map<string, number>();
  const visit = (task: EstimateNode, seen: Set<string>): number => {
    const kids = byParent.get(task.id);
    if (!kids?.length) return task.estimate_minutes ?? 0;
    let sum = 0;
    for (const kid of kids) if (!seen.has(kid.id)) sum += visit(kid, new Set(seen).add(kid.id));
    result.set(task.id, sum);
    return sum;
  };
  for (const t of tasks) if (byParent.has(t.id) && !result.has(t.id)) visit(t, new Set([t.id]));
  return result;
}

/** "90", "90m", "1h30", "1h 30min", "1,5h" → minutos; texto que não é duração → null. */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  if (!s) return null;
  const hm = /^(\d+(?:\.\d+)?)h(?:(\d+)(?:m|min)?)?$/.exec(s);
  if (hm) {
    const minutes = Math.round(Number(hm[1]) * 60) + Number(hm[2] ?? 0);
    return minutes > 0 ? minutes : null;
  }
  const m = /^(\d+)(?:m|min)?$/.exec(s);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}

/** 90 → "1h30", 45 → "45min", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** A data da filha passa da data da mãe? (aviso, não bloqueio) */
export function dueAfterParent(child: string | null, parent: string | null) {
  return !!child && !!parent && child > parent;
}
