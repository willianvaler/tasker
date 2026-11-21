import { barOf, diffDays } from './gantt';

// Linha de base no Gantt (GP2, D314): a foto das datas de um momento e a comparação com agora.
// Funções puras, com teste; quem tira a foto é o servidor (`save_baseline`).

export type BaselineItem = { t: string; s: string; e: string };
export type Baseline = { id: string; name: string; created_at: string; items: BaselineItem[] };

export type BaselineDiff = {
  /** Por tarefa que está nas duas: as datas do plano e o atraso no fim (positivo = atrasou) */
  byTask: Map<string, { start: string; end: string; delay: number }>;
  /** Com data agora e fora da foto: entraram depois */
  added: string[];
  /** Na foto e agora sem data (ou apagadas): saíram */
  removed: string[];
  /** Quantas terminam depois do plano e a soma dos dias */
  late: number;
  totalDelay: number;
};

/** O que veio do banco (jsonb) → itens válidos. */
export function readBaselineItems(items: unknown): BaselineItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is BaselineItem =>
      !!i &&
      typeof i === 'object' &&
      typeof (i as BaselineItem).t === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(String((i as BaselineItem).s)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(String((i as BaselineItem).e)),
  );
}

/** Compara as tarefas de agora (com as datas do Gantt) com a linha de base. */
export function compareBaseline(
  tasks: readonly { id: string; start_date: string | null; due_date: string | null }[],
  items: readonly BaselineItem[],
): BaselineDiff {
  const plan = new Map(items.map((i) => [i.t, i]));
  const byTask: BaselineDiff['byTask'] = new Map();
  const added: string[] = [];
  const present = new Set<string>();
  let late = 0;
  let totalDelay = 0;
  for (const task of tasks) {
    const bar = barOf(task);
    if (!bar) continue;
    present.add(task.id);
    const base = plan.get(task.id);
    if (!base) {
      added.push(task.id);
      continue;
    }
    const delay = diffDays(base.e, bar.end);
    byTask.set(task.id, { start: base.s, end: base.e, delay });
    if (delay > 0) {
      late += 1;
      totalDelay += delay;
    }
  }
  const removed = items.map((i) => i.t).filter((id) => !present.has(id));
  return { byTask, added, removed, late, totalDelay };
}

/** "+3 d", "−2 d" (vazio quando bate com o plano) */
export const delayLabel = (delay: number) =>
  delay === 0 ? '' : `${delay > 0 ? '+' : '−'}${Math.abs(delay)} d`;
