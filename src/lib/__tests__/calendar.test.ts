import { describe, expect, it } from '@jest/globals';

import {
  calendarDays,
  monthGrid,
  occurrences,
  shiftMonth,
  weekOf,
  type CalendarTask,
} from '../calendar';

// Mesmas datas do feed .ics (supabase/tests/calendario.test.sql: _ics_rrule)
describe('occurrences', () => {
  it('sem recorrência: só o vencimento, se estiver no intervalo', () => {
    expect(occurrences(null, '2026-11-03', '2026-11-01', '2026-11-30')).toEqual(['2026-11-03']);
    expect(occurrences(null, '2026-10-30', '2026-11-01', '2026-11-30')).toEqual([]);
    expect(occurrences(null, null, '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('diária: todo dia a partir do vencimento', () => {
    expect(occurrences({ type: 'daily' }, '2026-11-28', '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
    ]);
    expect(occurrences({ type: 'daily' }, '2026-10-01', '2026-11-01', '2026-11-02')).toEqual([
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('semanal: de 7 em 7 dias desde a data original', () => {
    expect(occurrences({ type: 'weekly' }, '2026-10-20', '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
    ]);
  });

  it('mensal: dia 31 cai no último dia do mês', () => {
    expect(occurrences({ type: 'monthly' }, '2026-01-31', '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('dias da semana: a própria data e depois os dias marcados', () => {
    // 2026-11-04 é quarta; seg (1), qua (3), sex (5)
    expect(
      occurrences({ type: 'weekdays', days: [1, 3, 5] }, '2026-11-04', '2026-11-01', '2026-11-10'),
    ).toEqual(['2026-11-04', '2026-11-06', '2026-11-09']);
    // Vencimento fora dos dias marcados ainda conta (como o DTSTART da RRULE)
    expect(
      occurrences({ type: 'weekdays', days: [1] }, '2026-11-03', '2026-11-01', '2026-11-10'),
    ).toEqual(['2026-11-03', '2026-11-09']);
    expect(
      occurrences({ type: 'weekdays', days: [1] }, '2026-10-01', '2026-11-03', '2026-11-10'),
    ).toEqual(['2026-11-09']);
  });
});

describe('grade', () => {
  it('semana começando no domingo ou na segunda', () => {
    expect(weekOf('2026-10-18', 0)[0]).toBe('2026-10-18');
    expect(weekOf('2026-10-18', 1)[0]).toBe('2026-10-12');
    expect(weekOf('2026-10-18', 1)[6]).toBe('2026-10-18');
  });

  it('mês em semanas inteiras', () => {
    const grid = monthGrid('2026-11', 0);
    expect(grid).toHaveLength(5);
    expect(grid[0][0]).toBe('2026-11-01');
    expect(grid[4][6]).toBe('2026-12-05');
    // Fevereiro de 2026 começa num domingo e cabe em 4 semanas
    expect(monthGrid('2026-02', 0)).toHaveLength(4);
    expect(monthGrid('2026-08', 0)).toHaveLength(6);
  });

  it('troca de mês', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('calendarDays', () => {
  const task = (id: string, patch: Partial<CalendarTask>): CalendarTask => ({
    id,
    title: id,
    status: 'todo',
    due_date: '2026-11-03',
    recurrence: null,
    page_id: 'lista',
    ...patch,
  });
  const pages = {
    lista: { name: 'Afazeres', workout: false, habits: false },
    treino: { name: 'Treino A', workout: true, habits: false },
    rotina: { name: 'Rotina', workout: false, habits: true },
  };

  it('treino vira um item por dia, antes das tarefas; hábitos ficam fora', () => {
    const days = calendarDays(
      [
        task('Pagar luz', {}),
        task('Supino', { page_id: 'treino' }),
        task('Remada', { page_id: 'treino' }),
        task('Beber água', { page_id: 'rotina', recurrence: { type: 'daily' } }),
      ],
      pages,
      '2026-11-01',
      '2026-11-30',
    );
    expect(Object.keys(days)).toEqual(['2026-11-03']);
    expect(days['2026-11-03']).toEqual([
      { kind: 'workout', id: 'treino:2026-11-03', title: 'Treino A', count: 2, pageId: 'treino' },
      { kind: 'task', id: 'Pagar luz', title: 'Pagar luz', done: false, pageId: 'lista' },
    ]);
  });

  it('concluída sem recorrência aparece riscada; recorrente segue aberta', () => {
    const days = calendarDays(
      [
        task('Feita', { status: 'done' }),
        task('Toda semana', { status: 'done', recurrence: { type: 'weekly' } }),
      ],
      pages,
      '2026-11-03',
      '2026-11-03',
    );
    expect(days['2026-11-03'].map((e) => e.kind === 'task' && e.done)).toEqual([true, false]);
  });
});
