import { describe, expect, it } from '@jest/globals';

import type { FlowDep, FlowTask } from '../flow-graph';
import { peopleBoard } from '../people-board';

const NOW = new Date('2026-10-14T12:00:00Z');
function task(id: string, extra: Partial<FlowTask> = {}): FlowTask {
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
    ...extra,
  };
}
const map = (...list: FlowTask[]) => new Map(list.map((t) => [t.id, t]));
const dep = (taskId: string, on: string): FlowDep => ({
  id: `${on}>${taskId}`,
  task_id: taskId,
  depends_on_task_id: on,
  lag_minutes: 0,
});

describe('peopleBoard', () => {
  const members = [
    { userId: 'w', displayName: 'Willian' },
    { userId: 'g', displayName: 'Greg' },
    { userId: 'a', displayName: 'Ana' },
  ];

  it('separa fazendo, pronta, bloqueada e concluída por pessoa', () => {
    const board = peopleBoard({
      tasks: map(
        task('carvão', { started_at: NOW.toISOString(), status: 'doing' }),
        task('fogo'),
        task('gelo', { status: 'done', completed_at: '2026-10-14T10:00:00Z' }),
        task('pratos'),
        task('sobra'),
      ),
      deps: [dep('fogo', 'carvão')],
      people: new Map([
        ['carvão', [{ userId: 'g', name: 'Greg' }]],
        ['gelo', [{ userId: 'g', name: 'Greg' }]],
        ['fogo', [{ userId: 'w', name: 'Willian' }]],
        ['pratos', [{ userId: null, name: 'Tia' }]],
      ]),
      members,
      me: 'w',
      now: NOW,
    });
    expect(board.map((c) => c.name)).toEqual(['Willian', 'Ana', 'Greg', 'Tia', '']);
    const by = Object.fromEntries(board.map((c) => [c.name, c]));
    expect(by.Greg.doing.map((t) => t.id)).toEqual(['carvão']);
    expect(by.Greg.done.map((t) => t.id)).toEqual(['gelo']);
    expect(by.Willian.blocked.map((t) => t.waitingOn)).toEqual([['carvão']]);
    expect(by.Tia.ready.map((t) => t.id)).toEqual(['pratos']);
    expect(by[''].ready.map((t) => t.id)).toEqual(['sobra']);
    expect(by.Ana.ready).toEqual([]);
  });

  it('mãe com filhas não conta (as filhas contam); tarefa com duas pessoas aparece nas duas', () => {
    const board = peopleBoard({
      tasks: map(task('mãe'), task('filha', { parent_task_id: 'mãe' })),
      deps: [],
      people: new Map([
        ['mãe', [{ userId: 'w', name: 'Willian' }]],
        [
          'filha',
          [
            { userId: 'w', name: 'Willian' },
            { userId: 'g', name: 'Greg' },
          ],
        ],
      ]),
      members,
      now: NOW,
    });
    const by = Object.fromEntries(board.map((c) => [c.name, c]));
    expect(by.Willian.ready.map((t) => t.id)).toEqual(['filha']);
    expect(by.Greg.ready.map((t) => t.id)).toEqual(['filha']);
    // Sem tarefa sem responsável: a coluna some
    expect(board.some((c) => c.key === '')).toBe(false);
  });
});
