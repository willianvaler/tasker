import { useIsFocused } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import type { Task } from '@/lib/queries/tasks';

// Seleção da lista (V2 §8 e §9): qual tarefa está selecionada, a lista visível em ordem (para
// J/K e setas) e os pedidos de edição (F2). Um store fora do React, com assinatura por seletor:
// mudar a seleção re-renderiza só as duas linhas que mudaram, não a lista inteira (D57).

type RenameTarget = { kind: 'page' | 'folder'; id: string };

type State = {
  selectedId: string | null;
  /** Tarefas da lista que está na tela, na ordem em que aparecem */
  list: Task[];
  /** Tarefa com o título em edição (F2) */
  editId: string | null;
  /** Página ou pasta com o nome em edição (F2 sem tarefa selecionada) */
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
  /** Seleciona a próxima (1) ou a anterior (-1); sem seleção, a primeira (ou a última). */
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

/** Lê um pedaço do estado; o componente só re-renderiza quando esse pedaço muda. */
export function useSelection<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => pick(state),
    () => pick(state),
  );
}

/** A tela em foco informa a ordem das tarefas que mostra (J/K, setas e os outros atalhos). */
export function useSelectableList(tasks: Task[]) {
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) selection.setList(tasks);
  }, [focused, tasks]);
}
