import { describe, expect, it } from '@jest/globals';

import { medicationBalance, monthlyUse, parsePills } from '@/lib/medications';

const base = {
  dose: 1,
  times_per_day: 1,
  every_days: 1,
  stock: 30,
  stock_on: '2026-10-01',
  paused: false,
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
