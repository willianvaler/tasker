import { describe, expect, it } from '@jest/globals';

import { barOf, diffDays, dragDates, ganttArrows, ganttPlan, type GanttTask } from '../gantt';

const task = (id: string, extra: Partial<GanttTask> = {}): GanttTask => ({
  id,
  title: id,
  page_id: 'p1',
  parent_task_id: null,
  status: 'todo',
  start_date: null,
  due_date: null,
  position: 0,
  ...extra,
});

describe('Gantt (PC3)', () => {
  it('barra do início ao vencimento; sem início, o dia do vencimento', () => {
    expect(barOf({ start_date: '2026-11-10', due_date: '2026-11-14' })).toEqual({
      start: '2026-11-10',
      end: '2026-11-14',
    });
    expect(barOf({ start_date: null, due_date: '2026-11-14' })).toEqual({
      start: '2026-11-14',
      end: '2026-11-14',
    });
    // Início depois do vencimento (dado antigo): vale o vencimento, como o trigger
    expect(barOf({ start_date: '2026-11-20', due_date: '2026-11-14' })?.start).toBe('2026-11-14');
    expect(barOf({ start_date: '2026-11-10', due_date: null })).toBeNull();
    expect(diffDays('2026-11-10', '2026-12-01')).toBe(21);
  });

  it('arrastar: mover, puxar o começo e o fim', () => {
    const t = { start_date: '2026-11-10', due_date: '2026-11-14' };
    expect(dragDates(t, 'move', 3)).toEqual({ start_date: '2026-11-13', due_date: '2026-11-17' });
    expect(dragDates(t, 'start', -2)).toEqual({ start_date: '2026-11-08', due_date: '2026-11-14' });
    expect(dragDates(t, 'start', 10)).toEqual({ start_date: '2026-11-14', due_date: '2026-11-14' });
    expect(dragDates(t, 'end', 2)).toEqual({ start_date: '2026-11-10', due_date: '2026-11-16' });
    expect(dragDates(t, 'end', -9)).toEqual({ start_date: '2026-11-10', due_date: '2026-11-10' });
    expect(dragDates(t, 'move', 0)).toBeNull();
    // Sem início: mover só muda o vencimento; puxar o começo cria o início
    const single = { start_date: null, due_date: '2026-11-14' };
    expect(dragDates(single, 'move', 1)).toEqual({ start_date: null, due_date: '2026-11-15' });
    expect(dragDates(single, 'start', -3)).toEqual({
      start_date: '2026-11-11',
      due_date: '2026-11-14',
    });
    expect(dragDates(single, 'end', 2)).toEqual({
      start_date: '2026-11-14',
      due_date: '2026-11-16',
    });
    expect(dragDates(single, 'end', -1)).toEqual({ start_date: null, due_date: '2026-11-13' });
    expect(dragDates({ start_date: null, due_date: null }, 'move', 1)).toBeNull();
  });

  it('linhas na ordem das listas, subtarefas abaixo da mãe, sem data à parte', () => {
    const tasks = [
      task('b', { page_id: 'p2', due_date: '2026-11-20', position: 1 }),
      task('a', { due_date: '2026-11-12', start_date: '2026-11-10', position: 2 }),
      task('a1', { parent_task_id: 'a', due_date: '2026-11-11' }),
      task('c', { position: 1 }),
      task('feita', { status: 'done' }),
    ];
    const plan = ganttPlan(tasks, [], { today: '2026-11-04', pageOrder: ['p1', 'p2'] });
    expect(plan.rows.map((r) => [r.task.id, r.depth])).toEqual([
      ['a', 0],
      ['a1', 1],
      ['b', 0],
    ]);
    expect(plan.undated.map((t) => t.id)).toEqual(['c']);
    expect(plan.from).toBe('2026-11-02');
    expect(plan.to).toBe('2026-11-25');
    expect(plan.days).toBe(24);
    // Tela larga: o fim estica até preencher
    expect(
      ganttPlan(tasks, [], { today: '2026-11-04', pageOrder: ['p1', 'p2'], minDays: 40 }).days,
    ).toBe(40);
  });

  it('começa antes do pré-requisito terminar: aviso', () => {
    const tasks = [
      task('compra', { due_date: '2026-11-12' }),
      task('piso', { start_date: '2026-11-11', due_date: '2026-11-15', position: 1 }),
      task('pintura', { start_date: '2026-11-16', due_date: '2026-11-18', position: 2 }),
    ];
    const deps = [
      { task_id: 'piso', depends_on_task_id: 'compra' },
      { task_id: 'pintura', depends_on_task_id: 'piso' },
    ];
    const plan = ganttPlan(tasks, deps, { today: '2026-11-04', pageOrder: ['p1'] });
    expect(plan.rows.filter((r) => r.early).map((r) => r.task.id)).toEqual(['piso']);
    // Feito o pré-requisito, não avisa mais
    const done = ganttPlan([{ ...tasks[0], status: 'done' }, tasks[1], tasks[2]], deps, {
      today: '2026-11-04',
      pageOrder: ['p1'],
    });
    expect(done.rows.some((r) => r.early)).toBe(false);
    expect(
      ganttArrows(plan.rows, [...deps, { task_id: 'piso', depends_on_task_id: 'fora' }]),
    ).toEqual([
      { from: 0, to: 1, id: 'compra>piso' },
      { from: 1, to: 2, id: 'piso>pintura' },
    ]);
  });

  it('projeto longo: no máximo um ano, a partir de uma semana antes de hoje', () => {
    const plan = ganttPlan(
      [task('velha', { due_date: '2025-01-01' }), task('longe', { due_date: '2027-06-01' })],
      [],
      { today: '2026-11-04', pageOrder: ['p1'] },
    );
    expect(plan.from).toBe('2026-10-28');
    expect(plan.days).toBe(366);
  });
});
