import { addDays, nextWeekday, type IsoDate } from './parser/dates';

// Adiar (M1, D138): para onde vai a data com um gesto. Sempre a partir de hoje (adiar uma
// atrasada não a deixa atrasada).

export type SnoozeTarget = 'tomorrow' | 'weekend' | 'nextWeek';

export function snoozeDate(target: SnoozeTarget, today: IsoDate): IsoDate {
  if (target === 'tomorrow') return addDays(today, 1);
  // Sábado / segunda que vem (sempre depois de hoje: no sábado, o próximo sábado)
  const day = nextWeekday(today, target === 'weekend' ? 6 : 1);
  return day === today ? addDays(day, 7) : day;
}
