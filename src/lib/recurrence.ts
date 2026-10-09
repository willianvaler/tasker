import { addDays, addMonths, isoWeekKey, weekdayOf, type IsoDate } from './parser/dates';
import type { Recurrence } from './parser/quick';

// Recorrência e hábitos no cliente. O servidor é a fonte de verdade (next_due_date, task_cycle_kind
// no banco); estas funções servem para a atualização otimista e para mostrar a sequência dos hábitos.

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Lê o jsonb do banco; qualquer coisa fora do formato vira null. */
export function asRecurrence(value: unknown): Recurrence | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as { type?: unknown; days?: unknown };
  if (r.type === 'daily' || r.type === 'weekly' || r.type === 'monthly') return { type: r.type };
  if (r.type === 'weekdays' && Array.isArray(r.days)) {
    const days = r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6);
    return days.length
      ? { type: 'weekdays', days: [...new Set(days)].sort((a, b) => a - b) }
      : null;
  }
  return null;
}

export function recurrenceLabel(r: Recurrence | null): string {
  if (!r) return '';
  switch (r.type) {
    case 'daily':
      return 'Todo dia';
    case 'weekly':
      return 'Toda semana';
    case 'monthly':
      return 'Todo mês';
    case 'weekdays':
      return r.days.length === 7 ? 'Todo dia' : r.days.map((d) => DAY_NAMES[d]).join(', ');
  }
}

/** Mesmo cálculo de public.next_due_date: nunca cai em hoje ou antes. */
export function nextDueDate(
  r: Recurrence | null,
  due: IsoDate | null,
  today: IsoDate,
): IsoDate | null {
  if (!r) return null;
  const start = due ?? today;
  const base = start > today ? start : today;
  switch (r.type) {
    case 'daily':
      return addDays(base, 1);
    case 'weekly': {
      let next = addDays(start, 7);
      while (next <= today) next = addDays(next, 7);
      return next;
    }
    case 'monthly': {
      let n = 1;
      let next = addMonths(start, n);
      while (next <= today) next = addMonths(start, ++n);
      return next;
    }
    case 'weekdays': {
      if (r.days.length === 0) return null;
      let next = addDays(base, 1);
      while (!r.days.includes(weekdayOf(next))) next = addDays(next, 1);
      return next;
    }
  }
}

/** O hábito está agendado para hoje? (por dias da semana: só nos dias marcados) */
export function isHabitDueOn(r: Recurrence | null, date: IsoDate): boolean {
  return r?.type !== 'weekdays' || r.days.includes(weekdayOf(date));
}

/** Período do hábito que contém a data, no formato das chaves de ciclo do banco. */
export function habitPeriodKey(r: Recurrence | null, date: IsoDate): string {
  if (r?.type === 'weekly') return isoWeekKey(date);
  if (r?.type === 'monthly') return date.slice(0, 7);
  return date;
}

/**
 * Sequência atual do hábito: quantos períodos seguidos foram cumpridos até agora.
 * O período atual ainda em aberto não quebra a sequência (dá tempo de fazer hoje).
 * Em "dias da semana", só os dias marcados contam.
 */
export function habitStreak(
  r: Recurrence | null,
  doneDates: Iterable<IsoDate>,
  today: IsoDate,
): number {
  const done = new Set<string>();
  for (const date of doneDates) done.add(habitPeriodKey(r, date));

  const step = (date: IsoDate): IsoDate => {
    if (r?.type === 'weekly') return addDays(date, -7);
    if (r?.type === 'monthly') return addMonths(date, -1);
    let prev = addDays(date, -1);
    while (!isHabitDueOn(r, prev)) prev = addDays(prev, -1);
    return prev;
  };

  let cursor = today;
  // Hoje não agendado (dia não marcado): começa pelo último dia agendado
  if (!isHabitDueOn(r, cursor)) cursor = step(cursor);
  // Período atual ainda sem marcação: não conta, mas também não quebra
  if (!done.has(habitPeriodKey(r, cursor))) cursor = step(cursor);

  let streak = 0;
  // Limite de segurança: 10 anos de dias
  for (let i = 0; i < 3660 && done.has(habitPeriodKey(r, cursor)); i++) {
    streak++;
    cursor = step(cursor);
  }
  return streak;
}
