import { describe, expect, it } from '@jest/globals';

import { bodySummary, byDay, changes, movingAverage } from '../body-trend';

const e = (day: string, value: number) => ({ day, value });

describe('peso e medidas', () => {
  it('um valor por dia (o último), em ordem', () => {
    expect(byDay([e('2026-10-03', 80), e('2026-10-01', 82), e('2026-10-03', 79.5)])).toEqual([
      e('2026-10-01', 82),
      e('2026-10-03', 79.5),
    ]);
  });

  it('média móvel de 7 dias', () => {
    const avg = movingAverage([e('2026-10-01', 80), e('2026-10-04', 79), e('2026-10-09', 78)]);
    expect(avg.map((a) => a.avg)).toEqual([80, 79.5, 78.5]);
  });

  it('cada mudança diz se aproximou da meta', () => {
    const list = [
      e('2026-10-01', 80),
      e('2026-10-02', 79),
      e('2026-10-03', 79.4),
      e('2026-10-04', 79.4),
    ];
    expect(changes(list, 75).map((c) => [c.change, c.toward])).toEqual([
      [-1, true],
      [0.4, false],
      [0, null],
    ]);
    // Meta de ganhar: subir aproxima
    expect(changes([e('2026-10-01', 60), e('2026-10-02', 61)], 65)[0].toward).toBe(true);
    expect(changes(list, null)[0].toward).toBeNull();
  });

  it('resumo: último, desde o primeiro, quanto falta e a direção', () => {
    expect(bodySummary([e('2026-10-01', 80), e('2026-10-08', 78.5)], 75)).toEqual({
      latest: e('2026-10-08', 78.5),
      sinceFirst: -1.5,
      toGoal: -3.5,
      reached: false,
      toward: true,
    });
    expect(bodySummary([e('2026-10-01', 75)], 75)?.reached).toBe(true);
    expect(bodySummary([], 75)).toBeNull();
  });
});
