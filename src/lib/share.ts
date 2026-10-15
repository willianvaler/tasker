import { isoWeekKey, type IsoDate } from './parser/dates';

// Página recebida (L2, D134): a conclusão do aluno é por ciclo da página. Espelho de
// public.task_cycle_kind / cycle_key_for (com os mesmos casos nos testes).

export function taskCycleKind(
  viewType: string,
  resetCycle: string | null | undefined,
  recurrence: unknown,
): string {
  if (viewType === 'habits') {
    const type = (recurrence as { type?: string } | null)?.type;
    return type === 'weekly' ? 'weekly' : type === 'monthly' ? 'monthly' : 'daily';
  }
  if (resetCycle === 'daily' || resetCycle === 'weekly' || resetCycle === 'manual')
    return resetCycle;
  return 'once';
}

export function cycleKeyFor(kind: string, today: IsoDate, manualCycle: number): string {
  if (kind === 'daily') return today;
  if (kind === 'weekly') return isoWeekKey(today);
  if (kind === 'monthly') return today.slice(0, 7);
  if (kind === 'manual') return `m${manualCycle}`;
  return 'once';
}

/** As tarefas com o "feito" do aluno no lugar do estado do autor. */
export function withMyChecks<T extends { id: string; status: string; completed_at: string | null }>(
  tasks: readonly T[],
  checks: ReadonlyMap<string, string>,
): T[] {
  return tasks.map((t) => {
    const at = checks.get(t.id);
    return { ...t, status: at ? 'done' : 'todo', completed_at: at ?? null };
  });
}
