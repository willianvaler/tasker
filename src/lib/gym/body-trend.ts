import { addDays, type IsoDate } from '../parser/dates';

// Peso e medidas (AC7.2, V6 §6): média móvel, distância da meta e se cada mudança aproximou ou
// afastou da meta (o gráfico pinta assim). Funções puras; os dados ficam em body_metrics.

export type BodyEntry = { day: IsoDate; value: number };

/** Ordem do dia mais velho para o mais novo; no mesmo dia vale o último registro. */
export function byDay(entries: BodyEntry[]): BodyEntry[] {
  const map = new Map<IsoDate, number>();
  for (const e of entries) map.set(e.day, e.value);
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, value]) => ({ day, value }));
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Média dos registros dos últimos `days` dias (contando o próprio), em cada dia com registro. */
export function movingAverage(entries: BodyEntry[], days = 7) {
  const list = byDay(entries);
  return list.map((e) => {
    const from = addDays(e.day, -(days - 1));
    const window = list.filter((x) => x.day >= from && x.day <= e.day);
    return {
      day: e.day,
      value: e.value,
      avg: round(window.reduce((s, x) => s + x.value, 0) / window.length),
    };
  });
}

/** Mudança de um registro para o seguinte e se aproximou da meta (sem meta, null). */
export function changes(entries: BodyEntry[], goal: number | null) {
  const list = byDay(entries);
  return list.slice(1).map((e, i) => {
    const before = list[i].value;
    const change = round(e.value - before);
    const toward =
      goal == null || change === 0 ? null : Math.abs(goal - e.value) < Math.abs(goal - before);
    return { day: e.day, value: e.value, change, toward };
  });
}

/** Resumo: o último, a mudança desde o primeiro, quanto falta para a meta e a direção. */
export function bodySummary(entries: BodyEntry[], goal: number | null) {
  const list = byDay(entries);
  if (!list.length) return null;
  const latest = list[list.length - 1];
  const last = changes(list, goal).pop() ?? null;
  return {
    latest,
    sinceFirst: round(latest.value - list[0].value),
    toGoal: goal == null ? null : round(goal - latest.value),
    reached: goal != null && Math.abs(goal - latest.value) < 0.05,
    toward: last?.toward ?? null,
  };
}
