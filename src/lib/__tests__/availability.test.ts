import { describe, expect, it } from '@jest/globals';

import {
  copyToWeekdays,
  formatIntervals,
  isoWeekday,
  mergeIntervals,
  parseClock,
  parseDayText,
  rulesFromWeek,
  subtractInterval,
  weekFromRules,
  weeklyMinutes,
  windowsOn,
  type AvailabilityException,
  type Week,
} from '../availability';

const iv = (starts: string, ends: string) => ({ starts, ends });
const except = (e: Partial<AvailabilityException>): AvailabilityException => ({
  id: 'x',
  starts_on: '2026-11-23',
  ends_on: '2026-11-23',
  starts: null,
  ends: null,
  note: null,
  ...e,
});

describe('parseClock', () => {
  it.each([
    ['9', '09:00'],
    ['9h', '09:00'],
    ['9h30', '09:30'],
    ['09:30', '09:30'],
    ['930', '09:30'],
    ['1430', '14:30'],
    ['3pm', '15:00'],
    ['12am', '00:00'],
  ])('%s → %s', (text, want) => expect(parseClock(text)).toBe(want));
  it('recusa o que não é hora', () => {
    expect(parseClock('25')).toBeNull();
    expect(parseClock('9:75')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock('abc')).toBeNull();
  });
  it('24 só como fim do dia', () => {
    expect(parseClock('24')).toBeNull();
    expect(parseClock('24', true)).toBe('24:00');
    expect(parseClock('24:00', true)).toBe('24:00');
  });
});

describe('parseDayText', () => {
  it.each([
    ['9-12, 14-18', '09:00–12:00, 14:00–18:00'],
    ['9h às 12h; 14:00–18:00', '09:00–12:00, 14:00–18:00'],
    ['9 a 12 e 14 a 18', '09:00–12:00, 14:00–18:00'],
    ['9am to 5pm', '09:00–17:00'],
    ['9 hasta 13 y 15 hasta 19', '09:00–13:00, 15:00–19:00'],
    ['20-24', '20:00–24:00'],
    // Sobreposição e trechos que encostam são juntados, em ordem
    ['14-18, 9-12, 11-13', '09:00–13:00, 14:00–18:00'],
    ['9-12, 12-13', '09:00–13:00'],
  ])('%s', (text, want) => {
    const r = parseDayText(text);
    expect(r.ok && formatIntervals(r.intervals)).toBe(want);
  });
  it('vazio é dia sem horário', () => {
    expect(parseDayText('  ')).toEqual({ ok: true, intervals: [] });
  });
  it.each(['9', '12-9', '9-9', '9-12-15', 'manhã', '9-25'])('recusa "%s"', (text) =>
    expect(parseDayText(text).ok).toBe(false),
  );
});

describe('trechos', () => {
  it('mergeIntervals junta e ordena', () => {
    expect(
      mergeIntervals([iv('14:00', '15:00'), iv('09:00', '10:00'), iv('09:30', '11:00')]),
    ).toEqual([iv('09:00', '11:00'), iv('14:00', '15:00')]);
  });
  it('subtractInterval corta no meio, na borda e fora', () => {
    const day = [iv('09:00', '12:00'), iv('14:00', '18:00')];
    expect(subtractInterval(day, iv('10:00', '11:00'))).toEqual([
      iv('09:00', '10:00'),
      iv('11:00', '12:00'),
      iv('14:00', '18:00'),
    ]);
    expect(subtractInterval(day, iv('11:00', '15:00'))).toEqual([
      iv('09:00', '11:00'),
      iv('15:00', '18:00'),
    ]);
    expect(subtractInterval(day, iv('08:00', '20:00'))).toEqual([]);
    expect(subtractInterval(day, iv('12:00', '14:00'))).toEqual(day);
  });
});

describe('semana', () => {
  const rules = [
    { weekday: 1, starts: '14:00:00', ends: '18:00:00' },
    { weekday: 1, starts: '09:00:00', ends: '12:00:00' },
    { weekday: 6, starts: '20:00:00', ends: '24:00:00' },
  ];
  it('weekFromRules lê as horas do banco e põe em ordem', () => {
    const week = weekFromRules(rules);
    expect(week[1]).toEqual([iv('09:00', '12:00'), iv('14:00', '18:00')]);
    expect(week[6]).toEqual([iv('20:00', '24:00')]);
    expect(week[7]).toEqual([]);
  });
  it('rulesFromWeek devolve as linhas do set_availability', () => {
    expect(rulesFromWeek(weekFromRules(rules))).toEqual([
      { weekday: 1, starts: '09:00', ends: '12:00' },
      { weekday: 1, starts: '14:00', ends: '18:00' },
      { weekday: 6, starts: '20:00', ends: '24:00' },
    ]);
  });
  it('weeklyMinutes soma a semana', () => {
    expect(weeklyMinutes(weekFromRules(rules))).toBe(7 * 60 + 4 * 60);
  });
  it('copyToWeekdays copia para segunda a sexta e deixa o fim de semana', () => {
    const week = copyToWeekdays(weekFromRules(rules), 1);
    expect(week[5]).toEqual(week[1]);
    expect(week[6]).toEqual([iv('20:00', '24:00')]);
  });
});

describe('windowsOn', () => {
  // 23/11/2026 é segunda
  const week: Week = {
    1: [iv('09:00', '12:00'), iv('14:00', '18:00')],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };
  it('isoWeekday: domingo é 7', () => {
    expect(isoWeekday('2026-11-23')).toBe(1);
    expect(isoWeekday('2026-11-29')).toBe(7);
  });
  it('sem exceção, a semana', () => {
    expect(windowsOn('2026-11-23', week, [])).toEqual(week[1]);
    expect(windowsOn('2026-11-24', week, [])).toEqual([]);
  });
  it('exceção do dia inteiro (num intervalo de dias) tira tudo', () => {
    const e = except({ starts_on: '2026-11-20', ends_on: '2026-11-25' });
    expect(windowsOn('2026-11-23', week, [e])).toEqual([]);
    expect(windowsOn('2026-11-30', week, [e])).toEqual(week[1]);
  });
  it('exceção de um trecho tira só o trecho', () => {
    const e = except({ starts: '10:00:00', ends: '15:00:00' });
    expect(windowsOn('2026-11-23', week, [e])).toEqual([
      iv('09:00', '10:00'),
      iv('15:00', '18:00'),
    ]);
  });
});
