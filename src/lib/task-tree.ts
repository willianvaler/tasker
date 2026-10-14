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

type TreeTask = Node & { position: number };

/** Filhas de cada tarefa, em ordem de posição. */
export function childrenMap<T extends TreeTask>(tasks: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.parent_task_id) continue;
    map.set(t.parent_task_id, [...(map.get(t.parent_task_id) ?? []), t]);
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position);
  return map;
}

export type BranchRow<T> = { task: T; level: number; hasChildren: boolean; expanded: boolean };

/** As linhas visíveis abaixo de uma tarefa (nível 2 em diante), descendo só nas expandidas. */
export function branchRows<T extends TreeTask>(
  root: T,
  children: Map<string, T[]>,
  expanded: ReadonlySet<string>,
): BranchRow<T>[] {
  const rows: BranchRow<T>[] = [];
  const walk = (task: T, level: number, seen: Set<string>) => {
    if (!expanded.has(task.id)) return;
    for (const kid of children.get(task.id) ?? []) {
      if (seen.has(kid.id)) continue;
      const hasChildren = (children.get(kid.id)?.length ?? 0) > 0;
      rows.push({ task: kid, level, hasChildren, expanded: hasChildren && expanded.has(kid.id) });
      walk(kid, level + 1, new Set(seen).add(kid.id));
    }
  };
  walk(root, 2, new Set([root.id]));
  return rows;
}

/** Nível da tarefa pela cadeia de mães (1 = raiz). */
export function levelOf(task: TreeTask, byId: ReadonlyMap<string, TreeTask>) {
  let level = 1;
  let current = task.parent_task_id ? byId.get(task.parent_task_id) : undefined;
  const seen = new Set<string>([task.id]);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    level++;
    current = current.parent_task_id ? byId.get(current.parent_task_id) : undefined;
  }
  return level;
}

/** Quantos níveis o galho que começa nesta tarefa tem (ela mesma conta 1). */
export function branchHeight(taskId: string, children: Map<string, TreeTask[]>): number {
  const walk = (id: string, seen: Set<string>): number => {
    let max = 0;
    for (const kid of children.get(id) ?? [])
      if (!seen.has(kid.id)) max = Math.max(max, walk(kid.id, new Set(seen).add(kid.id)));
    return 1 + max;
  };
  return walk(taskId, new Set([taskId]));
}

export type MovePlan =
  | { ok: true; parentId: string | null; position: number }
  | { ok: false; reason: 'first' | 'root' | 'limit' | 'full' };

/** Tab: vira a última filha da irmã de cima, se couber no limite. */
export function planIndent(
  task: TreeTask,
  tasks: readonly TreeTask[],
  maxDepth: number,
  maxChildren = 50,
): MovePlan {
  const children = childrenMap(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const siblings = task.parent_task_id
    ? (children.get(task.parent_task_id) ?? [])
    : tasks.filter((t) => !t.parent_task_id).sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((t) => t.id === task.id);
  if (index <= 0) return { ok: false, reason: 'first' };
  const newParent = siblings[index - 1];
  const kids = children.get(newParent.id) ?? [];
  if (kids.length >= maxChildren) return { ok: false, reason: 'full' };
  if (levelOf(newParent, byId) + branchHeight(task.id, children) > maxDepth)
    return { ok: false, reason: 'limit' };
  return { ok: true, parentId: newParent.id, position: (kids.at(-1)?.position ?? 0) + 1 };
}

/** Shift+Tab: vira irmã da mãe, logo depois dela. */
export function planOutdent(task: TreeTask, tasks: readonly TreeTask[]): MovePlan {
  if (!task.parent_task_id) return { ok: false, reason: 'root' };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const parent = byId.get(task.parent_task_id);
  if (!parent) return { ok: false, reason: 'root' };
  const aunts = tasks
    .filter((t) => t.parent_task_id === parent.parent_task_id && t.id !== task.id)
    .sort((a, b) => a.position - b.position);
  const next = aunts[aunts.findIndex((t) => t.id === parent.id) + 1];
  return {
    ok: true,
    parentId: parent.parent_task_id,
    position: next ? (parent.position + next.position) / 2 : parent.position + 1,
  };
}

/** Códigos WBS: raízes "1", "2"…; filhas "1.1", "1.2"…, na ordem de posição (concluídas contam). */
export function wbsCodes<T extends TreeTask>(tasks: readonly T[]): Map<string, string> {
  const children = childrenMap(tasks);
  const codes = new Map<string, string>();
  const walk = (list: T[], prefix: string, seen: Set<string>) =>
    list.forEach((task, i) => {
      if (seen.has(task.id)) return;
      const code = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      codes.set(task.id, code);
      walk(children.get(task.id) ?? [], code, new Set(seen).add(task.id));
    });
  walk(
    tasks.filter((t) => !t.parent_task_id).sort((a, b) => a.position - b.position),
    '',
    new Set(),
  );
  return codes;
}

/** Todas as mães (para abrir a árvore inteira na visão Estrutura). */
export function parentIds(tasks: readonly Node[]) {
  return [...new Set(tasks.flatMap((t) => (t.parent_task_id ? [t.parent_task_id] : [])))];
}

/** Estrutura em texto, uma linha por tarefa com recuo e código ("1.2 Cozinha [x]"). */
export function wbsOutline<T extends TreeTask & { title: string }>(tasks: readonly T[]) {
  const codes = wbsCodes(tasks);
  return [...codes.entries()]
    .map(([id, code]) => {
      const task = tasks.find((t) => t.id === id);
      const indent = '  '.repeat(code.split('.').length - 1);
      return `${indent}${code} ${task?.title ?? ''}${task?.status === 'done' ? ' [x]' : ''}`;
    })
    .join('\n');
}
