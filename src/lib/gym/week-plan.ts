import { addDays, weekdayOf, type IsoDate } from '../parser/dates';

// Plano da semana (AC9.5, V6 §8): cada treino (página) tem os dias da semana em que é feito, e a
// pessoa pode remarcar o de um dia para outro (ou pular) sem mexer no plano. Espelho do
// `_planned_on` no banco (o lembrete usa a mesma regra), com os mesmos casos nos dois testes.

/** Dia da semana como no banco: 0 = domingo ... 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Remarcação: o treino do dia `from` foi para `to` (null: pulado). */
export type WorkoutMove = { page_id: string; from_day: IsoDate; to_day: IsoDate | null };

/** O treino cai neste dia? Pelo plano, menos o que saiu dele, mais o que veio para ele. */
export function plannedOn(
  day: IsoDate,
  pageId: string,
  trainDays: readonly number[] | null | undefined,
  moves: readonly WorkoutMove[],
) {
  const mine = moves.filter((m) => m.page_id === pageId);
  if (mine.some((m) => m.to_day === day)) return true;
  if (mine.some((m) => m.from_day === day)) return false;
  return (trainDays ?? []).includes(weekdayOf(day));
}

export type PlanPage = { id: string; name: string; train_days?: readonly number[] | null };

/** Os próximos `days` dias a partir de hoje, com os treinos de cada um. */
export function weekPlan(
  today: IsoDate,
  pages: readonly PlanPage[],
  moves: readonly WorkoutMove[],
  days = 7,
) {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i);
    return { day, pages: pages.filter((p) => plannedOn(day, p.id, p.train_days, moves)) };
  });
}
