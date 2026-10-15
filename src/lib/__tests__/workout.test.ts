import { describe, expect, it } from '@jest/globals';

import type { Task } from '../queries/tasks';
import {
  adjustWeight,
  nextPending,
  setVolume,
  workoutElapsed,
  workoutItems,
  workoutProgress,
} from '../workout';

const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    parent_task_id: null,
    position: Number(id.replace(/\D/g, '')) || 0,
    status: 'todo',
    repeat_plan: null,
    ...extra,
  }) as Task;

describe('workoutItems', () => {
  const tasks = [
    task('t2', { repeat_plan: { mode: 'sets', total: 3 } }),
    task('t1'),
    task('t3'),
    task('t4', { parent_task_id: 't3', position: 1 }),
    task('t5', { parent_task_id: 't3', position: 2, status: 'done' }),
  ];
  const items = workoutItems(tasks, { t2: 1 });
  it('na ordem da lista, mãe vira as filhas', () =>
    expect(items.map((i) => i.task.id)).toEqual(['t1', 't2', 't4', 't5']));
  it('sem plano vale uma vez', () =>
    expect(items[0]).toMatchObject({ repeats: false, plan: { total: 1 } }));
  it('a conta vem do andamento', () => expect(items[1].reps).toBe(1));
  it('progresso por série', () => expect(workoutProgress(items)).toEqual({ done: 2, total: 6 }));
  it('próximo a fazer pula os feitos e os pulados, e dá a volta', () => {
    expect(nextPending(items, 0, [])).toBe(0);
    expect(nextPending(items, 0, ['t1'])).toBe(1);
    expect(nextPending(items, 3, [])).toBe(0);
    expect(nextPending(items, 0, ['t1', 't2', 't4'])).toBe(-1);
  });
});

describe('carga', () => {
  it.each([
    ['20kg', 2.5, '22,5kg'],
    ['20.5kg', 2, '22.5kg'],
    ['12,5kg', 2.5, '15kg'],
    ['12,5kg', 1, '13,5kg'],
    ['2kg', -5, '0kg'],
    [undefined, 2.5, '2,5kg'],
  ])('%s %d → %s', (weight, step, result) => expect(adjustWeight(weight, step)).toBe(result));
  it('volume = carga × reps', () => expect(setVolume({ weight: '42,5kg', reps: 10 })).toBe(425));
  it('sem carga, zero', () => expect(setVolume({ reps: 10 })).toBe(0));
});

it('tempo sem as pausas', () =>
  expect(workoutElapsed({ startedAt: 0, pausedMs: 30_000, pausedAt: null }, 90_000)).toBe(60));

it('em inglês, ponto', () => expect(adjustWeight('20lb', 2.5, false)).toBe('22.5lb'));
