import { describe, expect, it } from '@jest/globals';

import type { FlowDep, FlowTask } from '../flow-graph';
import { bottlenecks, overdueByPerson } from '../flow-stats';

const NOW = new Date('2026-10-14T12:00:00Z');
function task(id: string, extra: Partial<FlowTask & { due_date: string | null }> = {}) {
  return {
    id,
    title: id,
    page_id: 'p',
    parent_task_id: null,
    status: 'todo',
    completed_at: null,
    started_at: null,
    deps_mode: 'all',
    estimate_minutes: null,
    due_date: null,
    ...extra,
  };
}
const map = <T extends { id: string }>(...list: T[]) => new Map(list.map((t) => [t.id, t]));
const dep = (taskId: string, on: string): FlowDep => ({
  id: `${on}>${taskId}`,
  task_id: taskId,
  depends_on_task_id: on,
  lag_minutes: 0,
});

describe('bottlenecks', () => {
  it('conta quem espera em cadeia; a raiz vem primeiro', () => {
    // carvão → fogo → carne; carvão → espetos; gelo → bebida
    const result = bottlenecks(
      map(
        task('carvão'),
        task('fogo'),
        task('carne'),
        task('espetos'),
        task('gelo'),
        task('bebida'),
      ),
      [
        dep('fogo', 'carvão'),
        dep('carne', 'fogo'),
        dep('espetos', 'carvão'),
        dep('bebida', 'gelo'),
      ],
      { now: NOW },
    );
    expect(result).toEqual([
      { id: 'carvão', title: 'carvão', holds: 3 },
      // empate: o gelo não espera ninguém, dá para começar por ele
      { id: 'gelo', title: 'gelo', holds: 1 },
      { id: 'fogo', title: 'fogo', holds: 1 },
    ]);
  });

  it('concluída não é gargalo; sem bloqueio, lista vazia', () => {
    const done = { status: 'done', completed_at: '2026-10-14T10:00:00Z' };
    expect(bottlenecks(map(task('a', done), task('b')), [dep('b', 'a')], { now: NOW })).toEqual([]);
  });
});

describe('overdueByPerson', () => {
  it('conta as abertas com data passada, por pessoa', () => {
    const tasks = map(
      task('a', { due_date: '2026-10-10' }),
      task('b', { due_date: '2026-10-13' }),
      task('c', { due_date: '2026-10-14' }),
      task('d', { due_date: '2026-10-01', status: 'done' }),
      task('e', { due_date: '2026-10-02' }),
    );
    const people = new Map([
      ['a', [{ userId: 'g', name: 'Greg' }]],
      ['b', [{ userId: 'g', name: 'Greg' }]],
      ['c', [{ userId: 'w', name: 'Willian' }]],
    ]);
    expect(overdueByPerson(tasks, people, '2026-10-14')).toEqual([
      { name: 'Greg', count: 2 },
      { name: '', count: 1 },
    ]);
  });
});
