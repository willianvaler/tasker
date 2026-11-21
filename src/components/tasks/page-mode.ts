import { useSyncExternalStore } from 'react';

import { getListMode, setListMode, subscribeListMode, type ListMode } from '@/lib/prefs';

type PageLike = { id: string; view_type: string | null } | undefined;

/** Página de tarefas: lista ou kanban (as duas trocam de visão; hábitos, cards e gastos não). */
export function isTaskPage(page: PageLike) {
  return page?.view_type === 'list' || page?.view_type === 'kanban';
}

/** Lista com visões salvas (VS1): a de tarefas, o quadro e a de cards. */
export function hasViews(page: PageLike) {
  return isTaskPage(page) || page?.view_type === 'cards';
}

/** Visão da página (D262): a escolhida neste aparelho ou a padrão do tipo. */
export function usePageMode(page: PageLike): [ListMode, (mode: ListMode) => void] {
  const fallback: ListMode = page?.view_type === 'kanban' ? 'board' : 'list';
  const mode = useSyncExternalStore(subscribeListMode, () => {
    if (!page || !hasViews(page)) return 'list';
    const saved = getListMode(page.id, fallback);
    // Cards não têm quadro nem matriz embutidos, só as visões salvas
    return isTaskPage(page) || saved.startsWith('view:') ? saved : 'list';
  });
  const set = (next: ListMode) => {
    if (page) setListMode(page.id, next, fallback);
  };
  return [mode, set];
}
