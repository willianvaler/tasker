import { addDays, todayIn, type IsoDate } from './parser/dates';

// Estatísticas de tempo (K4, D132): por dia e por tarefa, a partir dos registros. Puro.

export type StatEntry = {
  ended_at: string;
  minutes: number;
  source: string;
  task_id: string | null;
  task_title?: string | null;
  page_id?: string | null;
};

export type DayStat = { day: IsoDate; pomodoros: number; minutes: number };

/** Os últimos `days` dias (do mais antigo a hoje), com pomodoros e minutos de cada um. */
export function statsByDay(
  entries: readonly StatEntry[],
  today: IsoDate,
  timeZone: string,
  days = 7,
) {
  const list: DayStat[] = Array.from({ length: days }, (_, i) => ({
    day: addDays(today, i - days + 1),
    pomodoros: 0,
    minutes: 0,
  }));
  const index = new Map(list.map((d, i) => [d.day, i]));
  for (const e of entries) {
    const i = index.get(todayIn(timeZone, new Date(e.ended_at)));
    if (i === undefined) continue;
    list[i].minutes += e.minutes;
    if (e.source === 'pomodoro') list[i].pomodoros += 1;
  }
  return list;
}

/** Onde foi o tempo: soma por chave (tarefa, lista), da maior para a menor. */
export function topBy<T extends StatEntry>(
  entries: readonly T[],
  key: (e: T) => string | null | undefined,
  label: (e: T) => string,
  limit = 5,
) {
  const sums = new Map<string, { key: string; label: string; minutes: number }>();
  for (const e of entries) {
    const k = key(e);
    if (!k) continue;
    const row = sums.get(k) ?? { key: k, label: label(e), minutes: 0 };
    row.minutes += e.minutes;
    sums.set(k, row);
  }
  return [...sums.values()].sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}
