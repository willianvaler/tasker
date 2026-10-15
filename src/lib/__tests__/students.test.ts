import { describe, expect, it } from '@jest/globals';

import { daysSince, historyByCycle, loadEvolution, type CheckLike } from '../students';

const check = (over: Partial<CheckLike>): CheckLike => ({
  id: Math.random().toString(),
  task_id: 's',
  title: 'Supino',
  cycle_key: '2026-W41',
  done_at: '2026-10-07T10:00:00Z',
  note: null,
  values: null,
  ...over,
});

const checks = [
  check({
    cycle_key: '2026-W41',
    done_at: '2026-10-07T10:00:00Z',
    values: [{ weight: '20kg' }, { weight: '22kg' }],
  }),
  check({ cycle_key: '2026-W42', done_at: '2026-10-14T10:00:00Z', values: [{ weight: '24kg' }] }),
  check({
    task_id: 'a',
    title: 'Alongar',
    cycle_key: '2026-W42',
    done_at: '2026-10-14T11:00:00Z',
    note: 'ombro',
  }),
];

describe('historyByCycle', () => {
  it('semana mais recente primeiro', () =>
    expect(historyByCycle(checks).map((g) => [g.cycle, g.items.length])).toEqual([
      ['2026-W42', 2],
      ['2026-W41', 1],
    ]));
});

describe('loadEvolution', () => {
  it('a maior carga de cada vez, em ordem', () =>
    expect(loadEvolution(checks)).toEqual([
      {
        taskId: 's',
        title: 'Supino',
        points: [
          { at: '2026-10-07T10:00:00Z', value: 22, label: '22kg' },
          { at: '2026-10-14T10:00:00Z', value: 24, label: '24kg' },
        ],
      },
    ]));
});

it('dias desde a última atividade', () => {
  expect(daysSince('2026-10-10T10:00:00Z', Date.parse('2026-10-15T09:00:00Z'))).toBe(4);
  expect(daysSince(null, 0)).toBeNull();
});
