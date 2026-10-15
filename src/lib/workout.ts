import type { Task } from './queries/tasks';
import { effectiveReps, readRepeatPlan, type RepeatPlan } from './repeat';
import type { TaskMeta } from './parser/quick';

// Modo Treino (J5, D127): a sequência guiada de uma página. Funções puras; a tela só chama.

/** Item sem plano vale uma vez só ("Feita" conclui). */
const SINGLE: RepeatPlan = { mode: 'count', total: 1 };

export type WorkoutItem = {
  task: Task;
  plan: RepeatPlan;
  /** Tem plano de verdade (séries/vezes) ou é o "uma vez só" */
  repeats: boolean;
  reps: number;
  done: boolean;
};

/** As folhas da página na ordem da lista (mãe com filhas vira as filhas). */
export function workoutItems(tasks: Task[], progress: Record<string, number>): WorkoutItem[] {
  const children = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const list = children.get(t.parent_task_id) ?? [];
    list.push(t);
    children.set(t.parent_task_id, list);
  }
  const out: WorkoutItem[] = [];
  const walk = (parent: string | null) => {
    for (const task of [...(children.get(parent) ?? [])].sort((a, b) => a.position - b.position)) {
      if (children.has(task.id)) {
        walk(task.id);
        continue;
      }
      const real = readRepeatPlan(task.repeat_plan);
      const plan = real ?? SINGLE;
      const done = task.status === 'done';
      out.push({
        task,
        plan,
        repeats: !!real,
        reps: effectiveReps(plan, done, progress[task.id]),
        done,
      });
    }
  };
  walk(null);
  return out;
}

/** Próximo item a fazer a partir de `from` (dá a volta); -1 se não sobrou nada. */
export function nextPending(items: WorkoutItem[], from: number, skipped: readonly string[]) {
  for (let i = 0; i < items.length; i++) {
    const index = (from + i) % items.length;
    const item = items[index];
    if (!item.done && !skipped.includes(item.task.id)) return index;
  }
  return -1;
}

/** Séries feitas e no total, para a barra do treino. */
export function workoutProgress(items: WorkoutItem[]) {
  return items.reduce(
    (acc, item) => ({ done: acc.done + item.reps, total: acc.total + item.plan.total }),
    { done: 0, total: 0 },
  );
}

const WEIGHT_RE = /^(\d{1,4}(?:[.,]\d{1,2})?)(kg|lb|lbs)$/i;

/** "20,5kg" → { value: 20.5, unit: 'kg', sep: ',' } (sem decimal, sep = null) */
export function parseWeight(weight: string | undefined | null) {
  const m = weight ? WEIGHT_RE.exec(weight.replace(/\s/g, '')) : null;
  if (!m) return null;
  return {
    value: Number(m[1].replace(',', '.')),
    unit: m[2].toLowerCase(),
    sep: m[1].includes(',') ? ',' : m[1].includes('.') ? '.' : null,
  };
}

/**
 * Carga ± passo, nunca abaixo de zero, no mesmo formato ("12,5kg" + 2,5 → "15kg"). Sem decimal
 * no original, o separador é o do idioma (`decimalComma`: pt e es).
 */
export function adjustWeight(
  weight: string | undefined | null,
  step: number,
  decimalComma = true,
): string {
  const parsed = parseWeight(weight) ?? { value: 0, unit: 'kg', sep: null };
  const value = Math.max(0, Math.round((parsed.value + step) * 100) / 100);
  const sep = parsed.sep ?? (decimalComma ? ',' : '.');
  return `${String(value).replace('.', sep)}${parsed.unit}`;
}

/** Volume de uma série: carga × repetições (sem um dos dois, zero). */
export function setVolume(meta: TaskMeta | null | undefined) {
  const weight = parseWeight(meta?.weight)?.value ?? 0;
  return weight * (meta?.reps ?? 0);
}

/** Tempo do treino sem as pausas. */
export function workoutElapsed(
  session: { startedAt: number; pausedMs: number; pausedAt: number | null },
  now: number,
) {
  const end = session.pausedAt ?? now;
  return Math.max(0, Math.floor((end - session.startedAt - session.pausedMs) / 1000));
}
