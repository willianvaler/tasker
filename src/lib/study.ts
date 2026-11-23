// Estudar (ES7, ESCOPO_V13 §5, D328): regras puras do projeto de estudo.

export type StudyTask = {
  id: string;
  title: string;
  page_id: string;
  parent_task_id: string | null;
  status: string;
  position: number;
};

/**
 * O que estudar agora: a primeira tarefa aberta e sem subtarefa aberta (a sessão), na ordem das
 * listas e, dentro de cada uma, na ordem da árvore (mãe antes das filhas, pela posição)
 */
export function nextSession<T extends StudyTask>(
  pages: readonly { id: string }[],
  tasks: readonly T[],
): { task: T; parent: T | null } | null {
  const children = new Map<string | null, T[]>();
  for (const t of tasks)
    children.set(t.parent_task_id, [...(children.get(t.parent_task_id) ?? []), t]);
  for (const list of children.values()) list.sort((a, b) => a.position - b.position);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = new Set(tasks.map((t) => t.id));
  const visit = (task: T): T | null => {
    if (task.status === 'done') return null;
    for (const child of children.get(task.id) ?? []) {
      const hit = visit(child);
      if (hit) return hit;
    }
    return (children.get(task.id) ?? []).some((c) => c.status !== 'done') ? null : task;
  };
  for (const page of pages) {
    // Raízes da lista: sem mãe, ou com a mãe fora do que veio
    const roots = tasks
      .filter((t) => t.page_id === page.id && (!t.parent_task_id || !ids.has(t.parent_task_id)))
      .sort((a, b) => a.position - b.position);
    for (const root of roots) {
      const hit = visit(root);
      if (hit)
        return {
          task: hit,
          parent: hit.parent_task_id ? (byId.get(hit.parent_task_id) ?? null) : null,
        };
    }
  }
  return null;
}

/** Vizinhos na ordem do material (anterior e próximo) */
export function neighbors<T extends { id: string }>(list: readonly T[], id: string) {
  const i = list.findIndex((m) => m.id === id);
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
    index: i,
  };
}

/** Tamanho do texto da leitura (multiplica o da anotação) */
export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;
export function nextScale(current: number, direction: 1 | -1) {
  const i = TEXT_SCALES.findIndex((s) => s >= current - 0.001);
  const at = i < 0 ? 1 : i;
  return TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, at + direction))];
}
