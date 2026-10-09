import { describe, expect, it } from '@jest/globals';

import { isoWeekKey } from '../parser/dates';
import {
  asRecurrence,
  habitStreak,
  isHabitDueOn,
  nextDueDate,
  recurrenceLabel,
} from '../recurrence';

// Quinta, 08/10/2026. Os mesmos casos de supabase/tests/fase2_ciclos.test.sql (next_due_date)
const today = '2026-10-08';

describe('nextDueDate (igual ao banco)', () => {
  it.each([
    [{ type: 'daily' }, '2026-10-08', '2026-10-08', '2026-10-09'],
    [{ type: 'daily' }, '2026-10-01', '2026-10-08', '2026-10-09'],
    [{ type: 'weekly' }, '2026-10-08', '2026-10-08', '2026-10-15'],
    [{ type: 'weekly' }, '2026-09-24', '2026-10-08', '2026-10-15'],
    [{ type: 'monthly' }, '2026-01-31', '2026-01-31', '2026-02-28'],
    [{ type: 'monthly' }, '2026-01-31', '2026-03-01', '2026-03-31'],
    [{ type: 'weekdays', days: [1, 3, 5] }, null, '2026-10-08', '2026-10-09'],
    [{ type: 'weekdays', days: [1, 3, 5] }, '2026-10-09', '2026-10-09', '2026-10-12'],
  ] as const)('%j de %s (hoje %s) → %s', (r, due, now, expected) => {
    expect(nextDueDate(asRecurrence(r), due, now)).toBe(expected);
  });
  it('sem recorrência', () => expect(nextDueDate(null, today, today)).toBeNull());
});

describe('isoWeekKey (igual ao to_char IYYY-"W"IW)', () => {
  it.each([
    ['2026-10-12', '2026-W42'],
    ['2026-10-11', '2026-W41'],
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2024-12-30', '2025-W01'],
  ])('%s → %s', (date, key) => expect(isoWeekKey(date)).toBe(key));
});

describe('habitStreak', () => {
  const daily = asRecurrence({ type: 'daily' });
  it('conta até hoje', () =>
    expect(habitStreak(daily, ['2026-10-06', '2026-10-07', '2026-10-08'], today)).toBe(3));
  it('hoje ainda não feito não quebra', () =>
    expect(habitStreak(daily, ['2026-10-06', '2026-10-07'], today)).toBe(2));
  it('um dia pulado quebra', () =>
    expect(habitStreak(daily, ['2026-10-05', '2026-10-07', '2026-10-08'], today)).toBe(2));
  it('nada feito', () => expect(habitStreak(daily, [], today)).toBe(0));
  it('sem recorrência = diário', () => expect(habitStreak(null, ['2026-10-07'], today)).toBe(1));

  const mwf = asRecurrence({ type: 'weekdays', days: [1, 3, 5] });
  it('dias da semana: pula os não marcados', () =>
    // seg 05, qua 07 (quinta 08 não é agendada)
    expect(habitStreak(mwf, ['2026-10-02', '2026-10-05', '2026-10-07'], today)).toBe(3));
  it('dias da semana: faltou na segunda', () =>
    expect(habitStreak(mwf, ['2026-10-02', '2026-10-07'], today)).toBe(1));

  const weekly = asRecurrence({ type: 'weekly' });
  it('semanal: semanas seguidas', () =>
    expect(habitStreak(weekly, ['2026-09-29', '2026-10-01', '2026-10-06'], today)).toBe(2));
});

describe('rótulos e agenda', () => {
  it('rótulo', () => {
    expect(recurrenceLabel(asRecurrence({ type: 'weekdays', days: [5, 1, 3] }))).toBe(
      'Seg, Qua, Sex',
    );
    expect(recurrenceLabel(asRecurrence({ type: 'daily' }))).toBe('Todo dia');
    expect(recurrenceLabel(null)).toBe('');
  });
  it('recorrência inválida vira null', () => {
    expect(asRecurrence({ type: 'weekdays', days: [9] })).toBeNull();
    expect(asRecurrence('x')).toBeNull();
  });
  it('agendado hoje', () => {
    expect(isHabitDueOn(asRecurrence({ type: 'weekdays', days: [4] }), today)).toBe(true);
    expect(isHabitDueOn(asRecurrence({ type: 'weekdays', days: [1] }), today)).toBe(false);
    expect(isHabitDueOn(asRecurrence({ type: 'weekly' }), today)).toBe(true);
  });
});
