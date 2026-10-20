import { describe, expect, it } from '@jest/globals';

import { best1Rm, estimate1Rm, percentTable, weightForReps } from '../one-rm';
import { setRecords, type RecordSet } from '../records';

const s = (
  weight_kg: number | null,
  reps: number | null,
  day = 'd1',
  extra: Partial<RecordSet> = {},
) => ({
  weight_kg,
  reps,
  day,
  ...extra,
});

describe('1RM', () => {
  it('Epley até 12 repetições; uma é a própria carga', () => {
    expect(estimate1Rm(100, 1)).toBe(100);
    expect(estimate1Rm(40, 10)).toBe(53.33);
    expect(estimate1Rm(42.5, 8)).toBe(53.83);
    expect(estimate1Rm(50, 13)).toBeNull();
    expect(estimate1Rm(null, 5)).toBeNull();
    expect(estimate1Rm(40, 0)).toBeNull();
  });

  it('melhor série diz qual foi, sem o aquecimento', () => {
    const best = best1Rm([
      { weight_kg: 100, reps: 1, warmup: true },
      { weight_kg: 40, reps: 10 },
      { weight_kg: 42.5, reps: 8 },
    ]);
    expect(best?.oneRm).toBe(53.83);
    expect(best?.set.weight_kg).toBe(42.5);
    expect(best1Rm([])).toBeNull();
  });

  it('calculadora: carga para N repetições e tabela de porcentagens', () => {
    expect(weightForReps(100, 1)).toBe(100);
    expect(weightForReps(100, 10)).toBe(75);
    const table = percentTable(100);
    expect(table[0]).toEqual({ pct: 100, kg: 100 });
    expect(table.find((r) => r.pct === 85)?.kg).toBe(85);
    expect(percentTable(61, 2.5).find((r) => r.pct === 80)?.kg).toBe(50);
    expect(table).toHaveLength(11);
  });
});

// Os mesmos casos do _set_records (supabase/tests/recordes.test.sql)
describe('recordes', () => {
  const base = [s(40, 10), s(40, 10)];

  it('mais carga e maior 1RM', () => {
    expect(setRecords(base, s(42.5, 8, 'd2'))).toEqual(['weight', 'one_rm']);
  });
  it('mais repetições na mesma carga', () => {
    expect(setRecords(base, s(40, 11, 'd2'))).toEqual(['reps', 'one_rm']);
  });
  it('igual não é recorde', () => {
    expect(setRecords(base, s(40, 10, 'd2'))).toEqual([]);
  });
  it('aquecimento e primeira série nunca são', () => {
    expect(setRecords(base, s(100, 1, 'd2', { warmup: true }))).toEqual([]);
    expect(setRecords([], s(40, 10))).toEqual([]);
    expect(setRecords([s(200, 1, 'd1', { warmup: true })], s(40, 10, 'd2'))).toEqual([]);
  });
  it('volume do dia só na série que passa do melhor dia', () => {
    const today = [...base, s(40, 10, 'd2')];
    expect(setRecords(today, s(40, 10, 'd2'))).toEqual([]);
    expect(setRecords(today, s(40, 11, 'd2'))).toEqual(['reps', 'one_rm', 'volume']);
    expect(setRecords([...today, s(40, 11, 'd2')], s(40, 5, 'd2'))).toEqual([]);
  });
  it('peso do corpo: mais repetições sem carga', () => {
    expect(setRecords([s(null, 15)], s(null, 16, 'd2'))).toEqual(['reps']);
  });
  it('acima de 12 repetições não estima 1RM', () => {
    expect(setRecords(base, s(50, 13, 'd2'))).toEqual(['weight']);
  });
  it('tempo e distância', () => {
    expect(
      setRecords(
        [s(null, null, 'd1', { duration_seconds: 45 })],
        s(null, null, 'd2', { duration_seconds: 60 }),
      ),
    ).toEqual(['duration']);
    expect(
      setRecords(
        [s(null, null, 'd1', { distance_m: 5000 })],
        s(null, null, 'd2', { distance_m: 5200 }),
      ),
    ).toEqual(['distance']);
  });
});
