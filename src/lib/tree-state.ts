import { useSyncExternalStore } from 'react';

// Quais tarefas-mãe estão abertas na lista. Fora do React (como a seleção): abrir uma mãe
// re-renderiza só quem olha para ela.

let expanded = new Set<string>();
const listeners = new Set<() => void>();

function set(next: Set<string>) {
  expanded = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const treeState = {
  get: () => expanded,
  isExpanded: (id: string) => expanded.has(id),
  expand: (id: string) => !expanded.has(id) && set(new Set(expanded).add(id)),
  collapse: (id: string) => {
    if (!expanded.has(id)) return;
    const next = new Set(expanded);
    next.delete(id);
    set(next);
  },
  toggle: (id: string) => (expanded.has(id) ? treeState.collapse(id) : treeState.expand(id)),
};

/** O conjunto inteiro (para montar as linhas visíveis). */
export function useExpanded() {
  return useSyncExternalStore(subscribe, treeState.get, treeState.get);
}

/** Só esta tarefa: a linha re-renderiza quando ela abre ou fecha, não quando outra muda. */
export function useIsExpanded(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => expanded.has(id),
    () => expanded.has(id),
  );
}
