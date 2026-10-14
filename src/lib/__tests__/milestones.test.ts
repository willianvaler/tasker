import { describe, expect, test } from '@jest/globals';

import { daysBetween, milestoneState, nextMilestone } from '../milestones';

const today = '2026-10-14';

describe('marcos', () => {
  test('dias entre datas, atravessando o mês', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(daysBetween(today, '2026-10-10')).toBe(-4);
  });

  test('estado em relação a hoje', () => {
    expect(milestoneState({ due_date: '2026-10-10', done_at: null }, today)).toEqual({
      kind: 'late',
      days: 4,
    });
    expect(milestoneState({ due_date: today, done_at: null }, today)).toEqual({ kind: 'today' });
    expect(milestoneState({ due_date: '2026-10-21', done_at: null }, today)).toEqual({
      kind: 'soon',
      days: 7,
    });
    expect(milestoneState({ due_date: '2026-10-22', done_at: null }, today).kind).toBe('later');
    expect(milestoneState({ due_date: null, done_at: null }, today).kind).toBe('undated');
    expect(
      milestoneState({ due_date: '2026-10-10', done_at: '2026-10-09T10:00:00Z' }, today).kind,
    ).toBe('done');
  });

  test('próximo marco: o atrasado mais antigo, ignorando concluídos e sem data', () => {
    const list = [
      { id: 'a', due_date: '2026-10-20', done_at: null },
      { id: 'b', due_date: '2026-10-01', done_at: '2026-10-01T00:00:00Z' },
      { id: 'c', due_date: null, done_at: null },
      { id: 'd', due_date: '2026-10-12', done_at: null },
    ];
    expect(nextMilestone(list)?.id).toBe('d');
    expect(nextMilestone([])).toBeUndefined();
  });
});
