import { describe, expect, it } from '@jest/globals';

import { compareBaseline, delayLabel, readBaselineItems } from '../baseline';

const task = (id: string, start: string | null, due: string | null) => ({
  id,
  start_date: start,
  due_date: due,
});

describe('readBaselineItems', () => {
  it('fica só com o que é válido', () => {
    expect(
      readBaselineItems([
        { t: 'a', s: '2026-12-01', e: '2026-12-05' },
        { t: 'b', s: 'ontem', e: '2026-12-05' },
        null,
        'x',
      ]),
    ).toEqual([{ t: 'a', s: '2026-12-01', e: '2026-12-05' }]);
    expect(readBaselineItems(null)).toEqual([]);
  });
});

describe('compareBaseline', () => {
  const items = [
    { t: 'a', s: '2026-12-01', e: '2026-12-05' },
    { t: 'b', s: '2026-12-06', e: '2026-12-10' },
    { t: 'c', s: '2026-12-11', e: '2026-12-12' },
    { t: 'gone', s: '2026-12-01', e: '2026-12-02' },
  ];
  const diff = compareBaseline(
    [
      task('a', '2026-12-01', '2026-12-08'), // +3
      task('b', '2026-12-05', '2026-12-08'), // −2
      task('c', null, '2026-12-12'), // igual
      task('novo', null, '2026-12-20'), // entrou depois
      task('sem', null, null), // sem data: não conta
    ],
    items,
  );
  it('atraso por tarefa e as datas do plano', () => {
    expect(diff.byTask.get('a')).toEqual({ start: '2026-12-01', end: '2026-12-05', delay: 3 });
    expect(diff.byTask.get('b')?.delay).toBe(-2);
    expect(diff.byTask.get('c')?.delay).toBe(0);
  });
  it('o que entrou e o que saiu', () => {
    expect(diff.added).toEqual(['novo']);
    expect(diff.removed).toEqual(['gone']);
  });
  it('só o atraso soma (adiantar não desconta)', () => {
    expect(diff.late).toBe(1);
    expect(diff.totalDelay).toBe(3);
  });
  it('delayLabel', () => {
    expect(delayLabel(3)).toBe('+3 d');
    expect(delayLabel(-2)).toBe('−2 d');
    expect(delayLabel(0)).toBe('');
  });
});
