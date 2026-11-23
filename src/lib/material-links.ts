// Material ligado à tarefa (ES6, D327). As ligações vêm prontas do servidor
// (`material_task_links`: pelo código e à mão); aqui só se junta o que vale para uma tarefa: as dela;
// sem nenhuma, as da tarefa mãe (a sessão herda da miniatura); sem nenhuma, as da lista ("Fase 0").

export type MaterialLinkRow = {
  material_id: string;
  material_name: string;
  material_folder_id: string;
  note_id: string | null;
  mime: string | null;
  target_kind: string;
  target_id: string;
  target_title: string;
  target_folder_id: string;
  auto: boolean;
};

export type TaskMaterial = MaterialLinkRow & { via: 'task' | 'parent' | 'page' };

const byName = (a: MaterialLinkRow, b: MaterialLinkRow) =>
  a.material_name.localeCompare(b.material_name, 'pt-BR', { numeric: true, sensitivity: 'base' });

/** `ancestors`: as tarefas mães, da mais próxima para a mais distante */
export function materialsForTask(
  rows: readonly MaterialLinkRow[],
  task: { id: string; page_id: string | null; ancestors?: readonly string[] },
): TaskMaterial[] {
  const pick = (kind: string, id: string | null) => {
    const seen = new Set<string>();
    return rows
      .filter((r) => r.target_kind === kind && r.target_id === id)
      .filter((r) => !seen.has(r.material_id) && seen.add(r.material_id))
      .sort(byName);
  };
  const own = pick('task', task.id);
  if (own.length) return own.map((r) => ({ ...r, via: 'task' }));
  for (const parent of task.ancestors ?? []) {
    const inherited = pick('task', parent);
    if (inherited.length) return inherited.map((r) => ({ ...r, via: 'parent' }));
  }
  return pick('page', task.page_id).map((r) => ({ ...r, via: 'page' }));
}
