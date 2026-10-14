import { describe, expect, test } from '@jest/globals';

import { ICON_IDS, isEmoji, searchIcons } from '../icon-names';

describe('busca de ícones (pt, en, es, sem acento)', () => {
  test.each([
    ['academia', 'dumbbell'],
    ['gym', 'dumbbell'],
    ['gimnasio', 'dumbbell'],
    ['mudança', 'package'],
    ['mudanca', 'package'],
    ['churrasco', 'party-popper'],
    ['Mercado', 'shopping-cart'],
  ])('"%s" acha %s', (query, id) => {
    expect(searchIcons(query)).toContain(id);
  });

  test('busca vazia mostra todos; sem resultado, lista vazia', () => {
    expect(searchIcons('  ')).toEqual(ICON_IDS);
    expect(searchIcons('zzzz')).toEqual([]);
  });
});

test('emoji', () => {
  expect(isEmoji('🔥')).toBe(true);
  expect(isEmoji('🏋️')).toBe(true);
  expect(isEmoji('👨‍👩‍👧')).toBe(true);
  expect(isEmoji('casa')).toBe(false);
  expect(isEmoji('🔥 fogo')).toBe(false);
});
