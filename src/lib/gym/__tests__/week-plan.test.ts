import { describe, expect, it } from '@jest/globals';

import { plannedOn, weekPlan } from '../week-plan';

// 2026-10-19 é segunda (1); 2026-10-21, quarta (3)
// Os mesmos casos do _planned_on (supabase/tests/plano_semana.test.sql)
describe('plano da semana', () => {
  const mwf = [1, 3, 5];

  it('pelo plano', () => {
    expect(plannedOn('2026-10-19', 'a', mwf, [])).toBe(true);
    expect(plannedOn('2026-10-20', 'a', mwf, [])).toBe(false);
    expect(plannedOn('2026-10-20', 'a', null, [])).toBe(false);
  });

  it('remarcar tira do dia e põe no outro; pular só tira', () => {
    const moves = [
      { page_id: 'a', from_day: '2026-10-19', to_day: '2026-10-20' },
      { page_id: 'a', from_day: '2026-10-21', to_day: null },
      { page_id: 'b', from_day: '2026-10-23', to_day: '2026-10-24' },
    ];
    expect(plannedOn('2026-10-19', 'a', mwf, moves)).toBe(false);
    expect(plannedOn('2026-10-20', 'a', mwf, moves)).toBe(true);
    expect(plannedOn('2026-10-21', 'a', mwf, moves)).toBe(false);
    // A remarcação de outro treino não mexe neste
    expect(plannedOn('2026-10-23', 'a', mwf, moves)).toBe(true);
  });

  it('a semana com os treinos de cada dia', () => {
    const plan = weekPlan(
      '2026-10-19',
      [
        { id: 'a', name: 'Treino A', train_days: [1, 4] },
        { id: 'b', name: 'Treino B', train_days: [2] },
      ],
      [],
      4,
    );
    expect(plan.map((d) => [d.day, d.pages.map((p) => p.name)])).toEqual([
      ['2026-10-19', ['Treino A']],
      ['2026-10-20', ['Treino B']],
      ['2026-10-21', []],
      ['2026-10-22', ['Treino A']],
    ]);
  });
});
