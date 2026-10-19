import { describe, expect, test } from '@jest/globals';

import { habitStep, habitStrength, habitValueNow } from '../habit-value';

// Os mesmos casos estão em supabase/tests/habit_value.test.sql (espelho do banco).
describe('força do hábito (HB2)', () => {
  test.each([
    [0, 1, 1],
    [1, 1, 1.9747],
    [-10, 1, -8.7079],
    [0, -1, -1.0267],
    [-1.0267, -1, -2.0811],
    [1.9747, -1, 1],
    [21, 1, 21.27],
    [-47.27, -1, -47.27],
  ] as const)('passo de %p com %p dá %p', (value, delta, expected) => {
    expect(habitStep(value, delta)).toBeCloseTo(expected, 3);
  });

  test('o − desfaz o + (e vice-versa)', () => {
    for (const v of [-30, -5, 0, 3.5, 12])
      expect(habitStep(habitStep(v, 1), -1)).toBeCloseTo(v, 3);
  });

  test.each([
    [8, 'up', '2026-10-17', '2026-10-19', 2],
    [-8, 'down', '2026-10-18', '2026-10-19', -4],
    [0.15, 'up', '2026-10-18', '2026-10-19', 0],
    [8, 'both', '2026-10-01', '2026-10-19', 8],
    [8, 'up', '2026-10-19', '2026-10-19', 8],
    [8, 'up', null, '2026-10-19', 8],
  ] as const)('valor %p (%p) de %p até %p: %p', (value, sides, since, today, expected) => {
    expect(habitValueNow(value, sides, since, today)).toBeCloseTo(expected, 4);
  });

  test('faixas de cor', () => {
    expect([-25, -15, -5, 0, 3, 7, 15].map(habitStrength)).toEqual([
      'worst',
      'bad',
      'weak',
      'neutral',
      'good',
      'strong',
      'best',
    ]);
  });
});
