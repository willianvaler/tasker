import { todayIn, type IsoDate } from '../parser/dates';
import type { Session } from './progression';
import type { WeightUnit } from './types';
import { fromKg, roundToStep, volumeKg } from './units';

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

/**
 * Sessões para a progressão (AC6): por dia, só as séries que contam, com a meta de cada uma e a
 * carga na unidade do plano. Do dia mais novo para o mais velho.
 */
export function diarySessions(
  sets: (SetLike & {
    duration_seconds?: number | null;
    target_reps?: number | null;
    target_sets?: number | null;
    target_seconds?: number | null;
  })[],
  timeZone: string,
  unit: WeightUnit,
): Session[] {
  return groupByDay(
    sets.filter((s) => !s.warmup),
    timeZone,
  ).map((d) => ({
    day: d.day,
    targetSets: Math.max(0, ...d.sets.map((s) => s.target_sets ?? 0)) || d.sets.length,
    sets: d.sets.map((s) => ({
      weight: s.weight_kg == null ? null : roundToStep(fromKg(s.weight_kg, unit), 0),
      reps: s.reps,
      seconds: s.duration_seconds ?? null,
      targetReps: s.target_reps ?? null,
      targetSeconds: s.target_seconds ?? null,
    })),
  }));
}
