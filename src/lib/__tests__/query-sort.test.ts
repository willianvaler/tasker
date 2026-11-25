import { describe, expect, it } from '@jest/globals';

import { compareSortValues, sortKey, type SortValue } from '../query/sort';

const order = (values: SortValue[], desc = false) =>
  [...values].sort((a, b) => compareSortValues(a, b, desc));

describe('ordem pelo cabeçalho da consulta (R2a)', () => {
  it('números em ordem de número, não de texto', () => {
    expect(order([10, 2, 1])).toEqual([1, 2, 10]);
    expect(order(['item 10', 'item 2'])).toEqual(['item 2', 'item 10']);
  });
  it('vazio fica no fim nas duas direções', () => {
    expect(order(['2026-12-01', null, '2026-11-30'])).toEqual(['2026-11-30', '2026-12-01', null]);
    expect(order(['2026-12-01', null, '2026-11-30'], true)).toEqual(['2026-12-01', '2026-11-30', null]);
  });
  it('acento e maiúscula não mudam a ordem', () => {
    expect(order(['Ébano', 'abacate', 'Banana'])).toEqual(['abacate', 'Banana', 'Ébano']);
  });
  it('a chave de cada tipo de valor', () => {
    expect(sortKey(undefined)).toBeNull();
    expect(sortKey('')).toBeNull();
    expect(sortKey(true)).toBe(1);
    expect(sortKey(['a', 'b'])).toBe('a, b');
    expect(sortKey(4)).toBe(4);
  });
});
