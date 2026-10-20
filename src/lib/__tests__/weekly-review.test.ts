import { describe, expect, test } from '@jest/globals';

import {
  distinctTasks,
  donePerPage,
  isReviewDue,
  reviewSince,
  staleBefore,
} from '../weekly-review';

const today = '2026-10-20';

describe('janelas', () => {
  test('últimos 7 dias e parado há 30', () => {
    expect(reviewSince(today)).toBe('2026-10-13');
    expect(staleBefore(today)).toBe('2026-09-20');
  });
});

describe('isReviewDue', () => {
  test('nunca fez: sugere', () => {
    expect(isReviewDue(undefined, today)).toBe(true);
    expect(isReviewDue({}, today)).toBe(true);
  });
  test('fez há menos de uma semana: não', () => {
    expect(isReviewDue({ done: '2026-10-14' }, today)).toBe(false);
  });
  test('uma semana ou mais: sugere', () => {
    expect(isReviewDue({ done: '2026-10-13' }, today)).toBe(true);
  });
  test('dispensar conta como a última', () => {
    expect(isReviewDue({ done: '2026-09-01', dismissed: '2026-10-19' }, today)).toBe(false);
  });
});

describe('concluídas', () => {
  const items = [
    { task_id: 'a', title: 'Ler', page: 'Casa' },
    { task_id: 'b', title: 'Lixo', page: 'Casa' },
    { task_id: 'b', title: 'Lixo', page: 'Casa' },
    { task_id: 'c', title: 'Pão', page: 'Compras' },
    { task_id: 'd', title: 'Ideia', page: null },
  ];
  test('por página, da maior para a menor', () => {
    expect(donePerPage(items)).toEqual([
      { page: 'Casa', count: 3 },
      { page: '', count: 1 },
      { page: 'Compras', count: 1 },
    ]);
  });
  test('uma linha por tarefa, com as vezes', () => {
    expect(distinctTasks(items).map((i) => [i.task_id, i.times])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 1],
      ['d', 1],
    ]);
  });
});
