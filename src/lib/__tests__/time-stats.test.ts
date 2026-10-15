import { describe, expect, it } from '@jest/globals';

import { statsByDay, topBy, type StatEntry } from '../time-stats';

const entries: StatEntry[] = [
  {
    ended_at: '2026-10-15T13:00:00Z',
    minutes: 25,
    source: 'pomodoro',
    task_id: 'a',
    task_title: 'A',
  },
  {
    ended_at: '2026-10-15T15:00:00Z',
    minutes: 40,
    source: 'manual',
    task_id: 'b',
    task_title: 'B',
  },
  // 01:30 em UTC do dia 15 ainda é dia 14 em São Paulo
  {
    ended_at: '2026-10-15T01:30:00Z',
    minutes: 25,
    source: 'pomodoro',
    task_id: 'a',
    task_title: 'A',
  },
  {
    ended_at: '2026-09-01T12:00:00Z',
    minutes: 99,
    source: 'manual',
    task_id: 'c',
    task_title: 'C',
  },
];

describe('statsByDay', () => {
  const days = statsByDay(entries, '2026-10-15', 'America/Sao_Paulo');
  it('sete dias, terminando hoje', () => {
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ day: '2026-10-15', pomodoros: 1, minutes: 65 });
  });
  it('o dia é o do fuso', () =>
    expect(days[5]).toEqual({ day: '2026-10-14', pomodoros: 1, minutes: 25 }));
  it('fora da janela não conta', () => expect(days.reduce((s, d) => s + d.minutes, 0)).toBe(90));
});

it('topBy: maior primeiro', () =>
  expect(
    topBy(
      entries,
      (e) => e.task_id,
      (e) => e.task_title ?? '',
    ),
  ).toEqual([
    { key: 'c', label: 'C', minutes: 99 },
    { key: 'a', label: 'A', minutes: 50 },
    { key: 'b', label: 'B', minutes: 40 },
  ]));
