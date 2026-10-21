import type { Task } from './queries/tasks';
import {
  DEFAULT_REST_SECONDS,
  MAX_REPEATS,
  effectiveReps,
  readRepeatPlan,
  type RepeatPlan,
} from './repeat';
import type { SetGroup, TaskMeta } from './parser/quick';

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

/** Superset ou circuito (AC9.4): os itens do mesmo grupo, na ordem da lista (sozinho não é grupo). */
export function supersetMembers(items: WorkoutItem[], index: number): number[] {
  const group = items[index]?.task.superset;
  if (!group) return [];
  const members = items.flatMap((it, i) => (it.task.superset === group ? [i] : []));
  return members.length > 1 ? members : [];
}

/**
 * Depois de uma série no item `index` de um grupo (com `items` já contando essa série): o
 * próximo do grupo que ainda tem série, na ordem e dando a volta; `rest` quando a volta fecha a
 * rodada (o descanso vem só no fim do grupo). null: o grupo acabou.
 */
export function supersetNext(
  items: WorkoutItem[],
  index: number,
  skipped: readonly string[] = [],
): { next: number; rest: boolean } | null {
  const members = supersetMembers(items, index);
  const pos = members.indexOf(index);
  if (pos === -1) return null;
  for (let step = 1; step <= members.length; step++) {
    const k = (pos + step) % members.length;
    const it = items[members[k]];
    if (it.done || skipped.includes(it.task.id)) continue;
    return { next: members[k], rest: pos + step >= members.length };
  }
  return null;
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

/** Descanso digitado: "90", "90s", "1:30", "2min", "2m". Vazio ou estranho: null. Até 1 h. */
export function parseRest(text: string): number | null {
  const v = text.trim().toLowerCase().replace(/\s+/g, '');
  let m = /^(\d{1,2}):([0-5]\d)$/.exec(v);
  const seconds = m
    ? Number(m[1]) * 60 + Number(m[2])
    : (m = /^(\d{1,4})(s|seg)?$/.exec(v))
      ? Number(m[1])
      : (m = /^(\d{1,2})(m|min)$/.exec(v))
        ? Number(m[1]) * 60
        : null;
  return seconds && seconds <= 3600 ? seconds : null;
}

/** "45s", "1:30", "2:00" */
export function formatRest(seconds: number | null | undefined): string {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Séries do painel viram o plano do Modo Treino (com o descanso entre elas). Sem séries, o plano de
 * séries sai; um plano de outro tipo (vezes, intervalo, cronometrado) só muda se houver séries.
 */
export function planFromSets(
  current: RepeatPlan | null,
  sets: number | null,
  rest: number | null,
): RepeatPlan | null {
  if (!sets || sets < 1) return current?.mode === 'sets' ? null : current;
  const base = current?.mode === 'sets' ? current : null;
  return {
    ...(base ?? {}),
    mode: 'sets',
    total: Math.min(sets, 99),
    rest_seconds: rest ?? base?.rest_seconds ?? DEFAULT_REST_SECONDS,
  };
}

/**
 * Descanso entre um exercício e o próximo no Modo Treino: o "depois" do plano ou, sem ele, o
 * mesmo das séries (o painel só grava esse). Item sem plano de séries não descansa.
 */
export function restBetweenExercises(plan: RepeatPlan, repeats: boolean): number | null {
  if (!repeats) return null;
  if (plan.rest_after_seconds) return plan.rest_after_seconds;
  return plan.mode === 'sets' && plan.rest_seconds ? plan.rest_seconds : null;
}

const positive = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= max;

/** Séries avançadas do item (só os grupos bem formados); sem elas, lista vazia. */
export function setGroups(meta: TaskMeta | null | undefined): SetGroup[] {
  if (!Array.isArray(meta?.groups)) return [];
  return meta.groups
    .filter((g) => g && positive(g.sets, MAX_REPEATS))
    .map((g) => ({
      sets: g.sets,
      ...(positive(g.reps, 999) ? { reps: g.reps } : {}),
      ...(typeof g.weight === 'string' && g.weight.trim() ? { weight: g.weight.trim() } : {}),
    }));
}

/**
 * O que a série `n` (0 = a primeira) pede: repetições e carga do grupo dela, com o que faltar
 * vindo do item. Série além dos grupos ("Mais uma série") repete o último.
 */
export function setPrescription(
  meta: TaskMeta | null | undefined,
  n: number,
): { reps?: number; weight?: string; group: number } {
  const groups = setGroups(meta);
  let group = groups.length - 1;
  for (let i = 0, end = 0; i < groups.length; i++) {
    end += groups[i].sets;
    if (n < end) {
      group = i;
      break;
    }
  }
  const g = groups[group];
  const reps = g?.reps ?? meta?.reps;
  const weight = g?.weight ?? meta?.weight;
  return { ...(reps ? { reps } : {}), ...(weight ? { weight } : {}), group };
}

/**
 * Carga ± passo na série `n`: com séries avançadas, muda a do grupo dela (que passa a ter carga
 * própria); sem elas, a do item.
 */
export function adjustSetWeight(
  meta: TaskMeta,
  n: number,
  step: number,
  decimalComma = true,
): TaskMeta {
  const groups = setGroups(meta);
  if (!groups.length) return { ...meta, weight: adjustWeight(meta.weight, step, decimalComma) };
  const { group, weight } = setPrescription(meta, n);
  const next = groups.map((g, i) =>
    i === group ? { ...g, weight: adjustWeight(weight, step, decimalComma) } : g,
  );
  return { ...meta, groups: next, ...(group === 0 ? { weight: next[0].weight } : {}) };
}

/**
 * Carga da série `n` passa a ser `weight` ("Usar no plano", AC4.7): com séries avançadas, a do
 * grupo dela; sem elas, a do item.
 */
export function setSetWeight(meta: TaskMeta, n: number, weight: string): TaskMeta {
  const groups = setGroups(meta);
  if (!groups.length) return { ...meta, weight };
  const { group } = setPrescription(meta, n);
  const next = groups.map((g, i) => (i === group ? { ...g, weight } : g));
  return { ...meta, groups: next, ...(group === 0 ? { weight } : {}) };
}

/** Passos da carga real da série no Modo Treino (AC4.7), na unidade da carga */
export const LOAD_STEPS = [-10, -5, -2.5, -1, 1, 2.5, 5, 10] as const;

/** A carga que a pessoa ajustou no Modo Treino, e para qual exercício e plano */
export type LoadOverride = { taskId: string; planned: string | null; weight: string };

/**
 * Carga real da série (AC4.7): a ajustada vale para as séries seguintes do mesmo exercício
 * enquanto o plano delas for o mesmo de quando ajustou (o grupo seguinte das séries avançadas,
 * com outra carga, volta ao plano); sem ajuste, a do plano.
 */
export function actualLoad(
  override: LoadOverride | null,
  taskId: string,
  planned: string | undefined,
): string | undefined {
  if (override && override.taskId === taskId && override.planned === (planned ?? null))
    return override.weight;
  return planned;
}

/** "1x14 · 2x10 40kg · 1x8 45kg": a carga só aparece onde muda. */
export function groupsLabel(groups: SetGroup[]): string {
  let weight: string | undefined;
  return groups
    .map((g) => {
      const part = `${g.sets}x${g.reps ?? '?'}`;
      if (!g.weight || g.weight === weight) return part;
      weight = g.weight;
      return `${part} ${g.weight}`;
    })
    .join(' · ');
}
