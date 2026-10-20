import { todayIn, type IsoDate } from '../parser/dates';
import { volumeKg } from './units';

// Histórico por exercício (AC4.6, V6 §3): as séries do diário agrupadas por dia, no fuso da
// pessoa, com as do dia na ordem em que foram feitas.

type SetLike = {
  performed_at: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  warmup: boolean;
};

export type HistoryDay<T extends SetLike> = {
  day: IsoDate;
  sets: T[];
  /** Séries que contam (sem o aquecimento) */
  workSets: number;
  volumeKg: number;
};

export function groupByDay<T extends SetLike>(sets: T[], timeZone: string): HistoryDay<T>[] {
  const days = new Map<IsoDate, T[]>();
  for (const set of sets) {
    const day = todayIn(timeZone, new Date(set.performed_at));
    const list = days.get(day);
    if (list) list.push(set);
    else days.set(day, [set]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, list]) => {
      const ordered = [...list].sort(
        (a, b) => a.performed_at.localeCompare(b.performed_at) || a.set_index - b.set_index,
      );
      return {
        day,
        sets: ordered,
        workSets: ordered.filter((s) => !s.warmup).length,
        volumeKg: volumeKg(ordered),
      };
    });
}
