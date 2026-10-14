// Dependência entre listas (V3 §2.3): a lista só libera quando a anterior chega a X% concluída.
// Espelho de public.page_progress/page_blockers (mesmos casos em page-deps.test.ts e no pgTAP
// dependencia_paginas). Progresso = folhas concluídas / folhas; lista vazia não segura.

export type PageDep = {
  id: string;
  page_id: string;
  depends_on_page_id: string;
  threshold_pct: number;
};
export type PageProgress = { done: number; total: number };
export type PageWait = { pageId: string; pct: number; threshold: number };

/** Progresso de uma lista pelas folhas (mãe com filhas é pacote). */
export function pageProgress(
  tasks: readonly { id: string; parent_task_id: string | null; status: string }[],
): PageProgress {
  const parents = new Set(tasks.map((t) => t.parent_task_id).filter(Boolean));
  const leaves = tasks.filter((t) => !parents.has(t.id));
  return { done: leaves.filter((t) => t.status === 'done').length, total: leaves.length };
}

/** O que segura a lista: as listas anteriores abaixo do percentual pedido. */
export function pageBlockers(
  pageId: string,
  deps: readonly PageDep[],
  progress: ReadonlyMap<string, PageProgress>,
): PageWait[] {
  return deps
    .filter((d) => d.page_id === pageId)
    .flatMap((d) => {
      const p = progress.get(d.depends_on_page_id) ?? { done: 0, total: 0 };
      if (p.total === 0 || p.done * 100 >= d.threshold_pct * p.total) return [];
      return [
        {
          pageId: d.depends_on_page_id,
          pct: Math.floor((p.done * 100) / p.total),
          threshold: d.threshold_pct,
        },
      ];
    });
}

/** Todas as listas bloqueadas do projeto (para o estado das tarefas). */
export function blockedPages(
  deps: readonly PageDep[],
  progress: ReadonlyMap<string, PageProgress>,
): Set<string> {
  return new Set(
    deps.map((d) => d.page_id).filter((id) => pageBlockers(id, deps, progress).length > 0),
  );
}
