import { describe, expect, it } from '@jest/globals';

import { buildRoadmap, releaseNotes, type RoadmapTask } from '../roadmap';

const task = (
  id: string,
  milestone: string | null,
  status = 'todo',
  due: string | null = null,
): RoadmapTask => ({
  id,
  title: id,
  status,
  due_date: due,
  milestone_id: milestone,
  parent_task_id: null,
});

describe('buildRoadmap', () => {
  const milestones = [
    { id: 'm2', name: 'v2', due_date: '2026-12-20', done_at: null },
    { id: 'm0', name: 'Sem data', due_date: null, done_at: null },
    { id: 'm1', name: 'v1', due_date: '2026-11-10', done_at: null },
  ];
  const tasks = [
    task('a', 'm1', 'done'),
    task('b', 'm1', 'todo', '2026-11-15'),
    task('c', 'm2', 'todo'),
    task('d', null),
    task('e', 'apagado'),
    { ...task('sub', 'm1'), parent_task_id: 'b' },
  ];
  const { entries, unlinked } = buildRoadmap(milestones, tasks, '2026-11-21', (id) => id === 'c');
  it('ordena por data, sem data por último', () => {
    expect(entries.map((e) => e.milestone.id)).toEqual(['m1', 'm2', 'm0']);
  });
  it('progresso, atrasadas, bloqueadas e o marco vencido', () => {
    const [v1, v2, none] = entries;
    expect([v1.done, v1.total, v1.late, v1.blocked, v1.overdue]).toEqual([1, 2, 1, 0, true]);
    expect([v2.done, v2.total, v2.late, v2.blocked, v2.overdue]).toEqual([0, 1, 0, 1, false]);
    expect(none.total).toBe(0);
    // Abertas primeiro; subtarefa não conta
    expect(v1.tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('conta as abertas sem marco (ou com marco apagado)', () => {
    expect(unlinked).toBe(2);
  });
});

describe('releaseNotes', () => {
  it('o que foi feito e o que ficou', () => {
    const md = releaseNotes(
      {
        milestone: { id: 'm', name: 'v1.0', due_date: null, done_at: null },
        tasks: [task('Login', 'm', 'done'), task('Busca', 'm')],
      },
      '2026-11-21',
    );
    expect(md).toBe(
      'v1.0 (2026-11-21)\n\n## Feito\n\n- Login\n\n## Ficou para depois\n\n- Busca\n',
    );
  });
});
