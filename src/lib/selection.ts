import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { Task } from '@/lib/queries/tasks';

// Fora do React, com assinatura por seletor: mudar a seleção re-renderiza só as duas linhas
// envolvidas, não a lista inteira.

type RenameTarget = { kind: 'page' | 'folder'; id: string };

type State = {
  selectedId: string | null;
  list: Task[];
  editId: string | null;
  rename: RenameTarget | null;
};

let state: State = { selectedId: null, list: [], editId: null, rename: null };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const selection = {
  get: () => state,
  select: (id: string | null) => set({ selectedId: id }),
  setList: (list: Task[]) => {
    // A seleção some se a tarefa saiu da lista (concluída, movida, outra tela)
    const keep = state.selectedId && list.some((t) => t.id === state.selectedId);
    set({ list, selectedId: keep ? state.selectedId : null });
  },
  move: (delta: 1 | -1) => {
    const { list, selectedId } = state;
    if (list.length === 0) return;
    const index = list.findIndex((t) => t.id === selectedId);
    const next =
      index === -1
        ? delta === 1
          ? 0
          : list.length - 1
        : Math.min(list.length - 1, Math.max(0, index + delta));
    set({ selectedId: list[next].id });
  },
  selectedTask: () => state.list.find((t) => t.id === state.selectedId) ?? null,
  edit: (id: string | null) => set({ editId: id }),
  rename: (target: RenameTarget | null) => set({ rename: target }),
};

export function useSelection<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => pick(state),
    () => pick(state),
  );
}

export function useSelectableList(tasks: Task[]) {
  const focused = useIsFocused();
  const mine = useRef<Task[] | null>(null);
  // A seleção desta lista enquanto outra tela está por cima (a anotação, a tarefa aberta)
  const saved = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (focused) {
      const back = saved.current;
      saved.current = undefined;
      mine.current = tasks;
      selection.setList(tasks);
      // Voltou: vale a seleção que era desta lista, não um clique feito na outra tela
      if (back !== undefined)
        selection.select(back && tasks.some((t) => t.id === back) ? back : null);
    } else if (mine.current && state.list === mine.current) {
      // Saiu de foco: a seleção não fica valendo para os atalhos de outra tela
      saved.current = state.selectedId;
      mine.current = null;
      selection.setList([]);
    }
  }, [focused, tasks]);
  // Desmontou (a anotação com a lista fechou): se a lista registrada ainda era esta, some
  useEffect(
    () => () => {
      if (mine.current && state.list === mine.current) selection.setList([]);
    },
    [],
  );
}
