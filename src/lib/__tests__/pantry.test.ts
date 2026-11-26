import { describe, expect, it } from '@jest/globals';

import {
  formatQty,
  pantryBuyTitle,
  pantryNeeds,
  parseQty,
  sortPantry,
  type PantryItem,
} from '../pantry';

// Os mesmos casos de supabase/tests/despensa.test.sql
describe('pantryNeeds (espelho de pantry_needs)', () => {
  it.each([
    [3, 2, false],
    [1, 2, true],
    [0, 3, true],
    [10, 3, false],
    [1, 0, false],
    [0, 0, true],
  ])('estoque %s, mínimo %s → %s', (qty, min, needs) => expect(pantryNeeds(qty, min)).toBe(needs));
});

describe('pantryBuyTitle (espelho de pantry_buy_title)', () => {
  it('nome e quanto comprar, como se escreve', () => {
    expect(pantryBuyTitle('Arroz', 5, 'kg')).toBe('Arroz (5 kg)');
    expect(pantryBuyTitle('Sal', 1, '')).toBe('Sal (1)');
    expect(pantryBuyTitle('Leite', 1.5, 'l')).toBe('Leite (1,5 l)');
    expect(pantryBuyTitle('Ovos', 10, 'un')).toBe('Ovos (10 un)');
  });
  it('formatQty sem zeros à direita', () => {
    expect(formatQty(2.5)).toBe('2,5');
    expect(formatQty(0.125)).toBe('0,125');
  });
});

describe('parseQty', () => {
  it.each([
    ['2', 2],
    ['1,5', 1.5],
    ['0', 0],
    ['-1', null],
    ['abc', null],
    ['', null],
    ['2000000', null],
  ])('%s → %s', (text, v) => expect(parseQty(text)).toBe(v));
});

describe('sortPantry', () => {
  const item = (id: string, qty: number, min: number, position: number): PantryItem => ({
    id,
    page_id: 'p',
    name: id,
    unit: '',
    qty,
    min_qty: min,
    buy_qty: 1,
    position,
    shopping_task_id: null,
  });
  it('o que falta primeiro, depois pela ordem', () => {
    expect(
      sortPantry([item('a', 5, 1, 1), item('b', 0, 1, 2), item('c', 3, 1, 0)]).map((i) => i.id),
    ).toEqual(['b', 'c', 'a']);
  });
});
