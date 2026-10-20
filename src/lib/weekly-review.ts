// Revisão semanal guiada (PB3, D223): o que concluí, o que ficou, o que está parado e o que vem.
// Funções puras; as consultas ficam em queries/review.ts.

import { addDays, type IsoDate } from './parser/dates';

/** Janela da revisão: os últimos 7 dias. */
export const REVIEW_DAYS = 7;
/** Tarefa sem data e sem mexer há tanto tempo entra em "parado". */
export const STALE_DAYS = 30;

/** Guardado em profiles.ui_prefs.review (vale em todos os aparelhos). */
export type ReviewPrefs = { done?: IsoDate; dismissed?: IsoDate };

export function reviewSince(today: IsoDate) {
  return addDays(today, -REVIEW_DAYS);
}

export function staleBefore(today: IsoDate) {
  return addDays(today, -STALE_DAYS);
}

/** O Início sugere a revisão quando a última (feita ou dispensada) tem uma semana ou mais. */
export function isReviewDue(prefs: ReviewPrefs | undefined, today: IsoDate) {
  const last = [prefs?.done, prefs?.dismissed].filter(Boolean).sort().pop();
  return !last || last <= reviewSince(today);
}

export type DoneItem = { task_id: string; title: string; page: string | null };

/** Concluídas por página, da que mais teve para a que menos (empate: nome). */
export function donePerPage(items: DoneItem[]) {
  const count = new Map<string, number>();
  for (const item of items) {
    const page = item.page ?? '';
    count.set(page, (count.get(page) ?? 0) + 1);
  }
  return [...count]
    .map(([page, n]) => ({ page, count: n }))
    .sort((a, b) => b.count - a.count || a.page.localeCompare(b.page));
}

/** Uma linha por tarefa (repetida que concluí várias vezes conta a vez de cada uma no total). */
export function distinctTasks(items: DoneItem[]) {
  const seen = new Map<string, DoneItem & { times: number }>();
  for (const item of items) {
    const prev = seen.get(item.task_id);
    seen.set(item.task_id, prev ? { ...prev, times: prev.times + 1 } : { ...item, times: 1 });
  }
  return [...seen.values()];
}
