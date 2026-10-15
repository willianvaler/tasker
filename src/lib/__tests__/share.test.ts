import { describe, expect, it } from '@jest/globals';

import { cycleKeyFor, taskCycleKind, withMyChecks } from '../share';

// Mesmos casos de public.task_cycle_kind / cycle_key_for
describe('ciclo da página', () => {
  it('cards com reinício semanal', () =>
    expect(taskCycleKind('cards', 'weekly', null)).toBe('weekly'));
  it('lista sem reinício', () => expect(taskCycleKind('list', 'none', null)).toBe('once'));
  it('hábito semanal', () =>
    expect(taskCycleKind('habits', 'none', { type: 'weekly' })).toBe('weekly'));
  it('chaves', () => {
    expect(cycleKeyFor('daily', '2026-10-15', 0)).toBe('2026-10-15');
    expect(cycleKeyFor('weekly', '2026-10-15', 0)).toBe('2026-W42');
    expect(cycleKeyFor('monthly', '2026-10-15', 0)).toBe('2026-10');
    expect(cycleKeyFor('manual', '2026-10-15', 3)).toBe('m3');
    expect(cycleKeyFor('once', '2026-10-15', 0)).toBe('once');
  });
});

it('o "feito" é o do aluno', () => {
  const tasks = [
    { id: 'a', status: 'done', completed_at: 'x' },
    { id: 'b', status: 'todo', completed_at: null },
  ];
  expect(withMyChecks(tasks, new Map([['b', '2026-10-15T10:00:00Z']]))).toEqual([
    { id: 'a', status: 'todo', completed_at: null },
    { id: 'b', status: 'done', completed_at: '2026-10-15T10:00:00Z' },
  ]);
});
