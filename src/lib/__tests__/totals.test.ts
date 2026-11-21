import { describe, expect, it } from '@jest/globals';

import {
  computeTotal,
  defaultTotal,
  isNumberColumn,
  nextTotal,
  readTotals,
  rollup,
  sumDescendants,
} from '../totals';

describe('totais do rodapé', () => {
  const nums = [10, null, 2.5, '', 7.5];
  it('coluna de número e o total padrão', () => {
    expect(isNumberColumn(nums)).toBe(true);
    expect(isNumberColumn(['a', 1])).toBe(false);
    expect(isNumberColumn([null, ''])).toBe(false);
    expect(defaultTotal(nums)).toBe('sum');
    expect(defaultTotal(['Compra'])).toBe('none');
  });
  it('soma, média, mínimo, máximo e contagem', () => {
    expect(computeTotal(nums, 'sum')).toEqual({ kind: 'number', total: 'sum', value: 20 });
    expect(computeTotal(nums, 'avg')).toMatchObject({ value: 6.666667 });
    expect(computeTotal(nums, 'min')).toMatchObject({ value: 2.5 });
    expect(computeTotal(nums, 'max')).toMatchObject({ value: 10 });
    expect(computeTotal(nums, 'count')).toMatchObject({ total: 'count', value: 3 });
    expect(computeTotal([0.1, 0.2], 'sum')).toMatchObject({ value: 0.3 });
    expect(computeTotal([null], 'sum')).toMatchObject({ kind: 'number', value: null });
  });
  it('quantas de cada valor; etiquetas contam uma a uma', () => {
    expect(computeTotal(['Obra', 'Compra', 'Obra', null], 'values')).toEqual({
      kind: 'values',
      counts: [
        { value: 'Obra', count: 2 },
        { value: 'Compra', count: 1 },
      ],
    });
    expect(computeTotal([['casa', 'rua'], ['casa'], []], 'values')).toMatchObject({
      counts: [
        { value: 'casa', count: 2 },
        { value: 'rua', count: 1 },
      ],
    });
    // Soma pedida em coluna de texto vira contagem
    expect(computeTotal(['a', 'b', ''], 'sum')).toMatchObject({ total: 'count', value: 2 });
  });
  it('nextTotal dá a volta e readTotals limpa', () => {
    expect(nextTotal('sum', true)).toBe('avg');
    expect(nextTotal('none', true)).toBe('sum');
    expect(nextTotal('values', false)).toBe('count');
    expect(nextTotal('none', false)).toBe('values');
    expect(readTotals({ due: 'sum', x: 'media', y: 3 })).toEqual({ due: 'sum' });
    expect(readTotals(null)).toEqual({});
  });
});

describe('rollup (total das filhas na mãe)', () => {
  const kids = new Map([
    ['mae', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]],
    ['b', [{ id: 'b1' }, { id: 'b2' }]],
  ]);
  const values: Record<string, number | null> = { a: 3, b: null, b1: 2, b2: 5, c: null };
  it('a filha vale o próprio valor ou o total das dela', () => {
    expect(rollup('mae', kids, (id) => values[id] ?? null)).toBe(10);
    expect(rollup('b', kids, (id) => values[id] ?? null)).toBe(7);
  });
  it('o tempo soma todas as descendentes', () => {
    const minutes: Record<string, number> = { a: 10, b: 5, b1: 20, b2: 0, c: 0 };
    expect(sumDescendants('mae', kids, (id) => minutes[id] ?? 0)).toBe(35);
  });
  it('sem filha com valor, nada', () => {
    expect(rollup('a', kids, () => null)).toBeNull();
    expect(rollup('mae', kids, () => null)).toBeNull();
  });
});
