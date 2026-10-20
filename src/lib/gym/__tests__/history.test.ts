import { describe, expect, it } from '@jest/globals';

import { groupByDay } from '../history';

const set = (
  performed_at: string,
  set_index: number,
  extra: Partial<{ weight_kg: number; reps: number; warmup: boolean }> = {},
) => ({
  performed_at,
  set_index,
  weight_kg: extra.weight_kg ?? 40,
  reps: extra.reps ?? 10,
  warmup: extra.warmup ?? false,
});

describe('groupByDay', () => {
  it('agrupa no fuso da pessoa, do dia mais novo para o mais velho', () => {
    const days = groupByDay(
      [
        set('2026-10-20T01:30:00Z', 2), // 22h30 do dia 19 em São Paulo
        set('2026-10-20T01:00:00Z', 1),
        set('2026-10-20T12:00:00Z', 1, { warmup: true, weight_kg: 20 }),
        set('2026-10-20T12:05:00Z', 1, { weight_kg: 50, reps: 5 }),
      ],
      'America/Sao_Paulo',
    );
    expect(days.map((d) => d.day)).toEqual(['2026-10-20', '2026-10-19']);
    expect(days[1].sets.map((s) => s.set_index)).toEqual([1, 2]);
    expect(days[0].workSets).toBe(1);
    expect(days[0].volumeKg).toBe(250);
    expect(days[0].sets[0].warmup).toBe(true);
  });

  it('vazio', () => {
    expect(groupByDay([], 'UTC')).toEqual([]);
  });
});
