import { useSyncExternalStore } from 'react';

import { gamificationConfig } from '@/lib/gamification.config';

// XP estimado de ações que ainda estão na fila (sem conexão ou servidor lento). Só para mostrar
// "+10 XP pendente": quem concede é o servidor, e a estimativa some quando o comando sobe e o
// game_state oficial chega. Não conta anti-farm nem bônus de sequência; por isso "~".
const pending = new Map<string, number>();
const listeners = new Set<() => void>();
let total = 0;

function emit() {
  total = [...pending.values()].reduce((sum, xp) => sum + xp, 0);
  for (const listener of listeners) listener();
}

export const pendingXp = {
  add(commandId: string, xp: number) {
    if (xp <= 0) return;
    pending.set(commandId, xp);
    emit();
  },
  resolve(commandId: string) {
    if (pending.delete(commandId)) emit();
  },
  clear() {
    if (pending.size === 0) return;
    pending.clear();
    emit();
  },
};

export function usePendingXp() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => total,
    () => total,
  );
}

/** Estimativa do XP de concluir (espelho simplificado do _xp_for_completion do banco). */
export function estimateCompletionXp(task: {
  priority: number;
  parent_task_id: string | null;
  recurrence: unknown;
  view_type?: string | null;
}) {
  const { xp } = gamificationConfig;
  if (task.parent_task_id || task.view_type === 'cards') return xp.checklistItem;
  const base = task.view_type === 'habits' || task.recurrence ? xp.habit : xp.task;
  return Math.round(base * (xp.priorityMultiplier[task.priority] ?? 1));
}
