import { useSyncExternalStore } from 'react';

import { getListMode, setListMode, subscribeListMode, type ListMode } from '@/lib/prefs';

type PageLike = { id: string; view_type: string | null } | undefined;

/** Página de tarefas: lista ou kanban (as duas trocam de visão; hábitos, cards e gastos não). */
export function isTaskPage(page: PageLike) {
  return page?.view_type === 'list' || page?.view_type === 'kanban';
}

/** Visão da página (D262): a escolhida neste aparelho ou a padrão do tipo. */
export function usePageMode(page: PageLike): [ListMode, (mode: ListMode) => void] {
  const fallback: ListMode = page?.view_type === 'kanban' ? 'board' : 'list';
  const mode = useSyncExternalStore(subscribeListMode, () =>
    page && isTaskPage(page) ? getListMode(page.id, fallback) : 'list',
  );
  const set = (next: ListMode) => {
    if (page) setListMode(page.id, next, fallback);
  };
  return [mode, set];
}
