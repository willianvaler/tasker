import { describe, expect, it } from '@jest/globals';

import {
  adherence,
  dosesOfDay,
  intakeFor,
  intakeId,
  isDoseDay,
  medicationBalance,
  monthlyUse,
  parseDoseTimes,
  parsePills,
  SNOOZE_MAX,
  type Medication,
} from '@/lib/medications';

const base = {
  dose: 1,
  times_per_day: 1,
  every_days: 1,
  stock: 30,
  stock_on: '2026-10-01',
  paused: false,
  weekdays: [] as number[],
};

describe('medicationBalance', () => {
  it('um por dia: desconta a partir do dia seguinte à contagem', () => {
    expect(medicationBalance(base, '2026-10-01')).toMatchObject({
      left: 30,
      lastDay: '2026-10-31',
      daysLeft: 30,
      state: 'ok',
    });
    expect(medicationBalance(base, '2026-10-11')).toMatchObject({ left: 20, daysLeft: 20 });
  });

  it('duas vezes por dia acaba na metade do tempo', () => {
    const b = medicationBalance({ ...base, times_per_day: 2 }, '2026-10-06');
    expect(b).toMatchObject({ left: 20, perDoseDay: 2, lastDay: '2026-10-16', daysLeft: 10 });
  });

  it('meio comprimido e dia sim, dia não', () => {
    const b = medicationBalance({ ...base, dose: 0.5, every_days: 2, stock: 10 }, '2026-10-05');
    // 10 comprimidos = 20 doses de meio, uma a cada 2 dias: 40 dias
    expect(b).toMatchObject({ left: 9, lastDay: '2026-11-10' });
  });

  it('acaba: perto do fim, no último dia e depois', () => {
    expect(medicationBalance(base, '2026-10-25').state).toBe('low');
    expect(medicationBalance(base, '2026-10-31')).toMatchObject({
      left: 0,
      daysLeft: 0,
      state: 'low',
    });
    expect(medicationBalance(base, '2026-11-02')).toMatchObject({
      left: 0,
      daysLeft: 0,
      state: 'out',
    });
    expect(medicationBalance({ ...base, stock: 0 }, '2026-10-01').state).toBe('out');
  });

  it('parado não desconta', () => {
    expect(medicationBalance({ ...base, paused: true }, '2026-12-01')).toMatchObject({
      left: 30,
      lastDay: null,
      state: 'paused',
    });
  });
});

it('gasto do mês', () => {
  expect(monthlyUse({ dose: 1, times_per_day: 2, every_days: 1 })).toBe(60);
  expect(monthlyUse({ dose: 1, times_per_day: 1, every_days: 7 })).toBe(4.29);
});

it.each([
  ['30', 30],
  ['1,5', 1.5],
  ['0.5', 0.5],
  ['½', 0.5],
  ['1/2', 0.5],
  ['', null],
  ['abc', null],
  ['-2', null],
])('parsePills(%p) = %p', (text, value) => expect(parsePills(text)).toBe(value));

// SA3 (D385): horários, dias da semana e o histórico das doses
const med: Medication = {
  id: '0190a000-0000-7000-8000-000000000001',
  name: 'Losartana',
  dose: 1,
  times_per_day: 2,
  every_days: 1,
  pack_size: 30,
  stock: 30,
  stock_on: '2026-10-01',
  paused: false,
  notes: null,
  dose_times: ['08:00', '20:00'],
  weekdays: [],
  show_name: false,
};

describe('dias da semana', () => {
  // 2026-10-05 é segunda (1)
  it('só os dias marcados são de dose', () => {
    const m = { ...med, weekdays: [1, 3, 5] };
    expect(isDoseDay(m, '2026-10-05')).toBe(true);
    expect(isDoseDay(m, '2026-10-06')).toBe(false);
  });

  it('dia sim, dia não conta da contagem, também antes dela', () => {
    const m = { ...med, every_days: 2 };
    expect(isDoseDay(m, '2026-10-03')).toBe(true);
    expect(isDoseDay(m, '2026-10-04')).toBe(false);
    expect(isDoseDay(m, '2026-09-29')).toBe(true);
  });

  it('o saldo desconta só os dias marcados', () => {
    // seg, qua, sex, 1 por dia, 6 comprimidos a partir de qui 01/10: sex 2, seg 5, qua 7, sex 9, seg 12, qua 14
    const b = medicationBalance({ ...base, stock: 6, weekdays: [1, 3, 5] }, '2026-10-08');
    expect(b).toMatchObject({ left: 3, lastDay: '2026-10-14' });
    expect(monthlyUse({ ...base, weekdays: [1, 3, 5] })).toBeCloseTo(12.86, 1);
  });
});

describe('parseDoseTimes', () => {
  it('aceita hora solta, com h e com dois-pontos, sem repetir e em ordem', () => {
    expect(parseDoseTimes('20:30, 8; 13h 8:00')).toEqual(['08:00', '13:00', '20:30']);
    expect(parseDoseTimes('')).toEqual([]);
  });

  it('recusa o que não é horário', () => {
    expect(parseDoseTimes('25:00')).toBeNull();
    expect(parseDoseTimes('manhã')).toBeNull();
  });
});

describe('doses do dia', () => {
  it('o id da dose é sempre o mesmo para o remédio, o dia e o horário', () => {
    const a = intakeId(med.id, '2026-10-05', '08:00:00');
    expect(a).toBe(intakeId(med.id, '2026-10-05', '08:00'));
    expect(a).not.toBe(intakeId(med.id, '2026-10-05', '20:00'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('na hora, depois, tomada e adiada', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const taken = intakeFor(med.id, '2026-10-05', '08:00', 'taken', null, now);
    expect(dosesOfDay([med], [taken!], '2026-10-05', 9 * 60).map((d) => d.state)).toEqual([
      'taken',
      'later',
    ]);
    expect(dosesOfDay([med], [], '2026-10-05', 21 * 60).map((d) => d.state)).toEqual([
      'due',
      'due',
    ]);
    expect(dosesOfDay([{ ...med, paused: true }], [], '2026-10-05', 21 * 60)).toEqual([]);
  });

  it('adiar soma 15 min e para em 3', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const first = intakeFor(med.id, '2026-10-05', '08:00', 'snoozed', null, now);
    expect(first).toMatchObject({ snoozes: 1, snoozed_until: '2026-10-05T12:15:00.000Z' });
    const last = intakeFor(med.id, '2026-10-05', '08:00', 'snoozed', { snoozes: SNOOZE_MAX }, now);
    expect(last).toBeNull();
    // Tomar depois de adiar guarda quantas vezes adiou
    expect(intakeFor(med.id, '2026-10-05', '08:00', 'taken', { snoozes: 2 }, now)).toMatchObject({
      status: 'taken',
      snoozes: 2,
      snoozed_until: null,
    });
  });

  it('quantas tomou nos últimos dias, sem contar hoje', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    const intakes = [
      intakeFor(med.id, '2026-10-07', '08:00', 'taken', null, now)!,
      intakeFor(med.id, '2026-10-07', '20:00', 'skipped', null, now)!,
      intakeFor(med.id, '2026-10-06', '08:00', 'taken', null, now)!,
      intakeFor(med.id, '2026-10-08', '08:00', 'taken', null, now)!,
    ];
    expect(adherence(med, intakes, '2026-10-08', 7)).toEqual({ taken: 2, expected: 14 });
  });
});
