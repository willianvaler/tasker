import { describe, expect, test } from '@jest/globals';

import {
  formatIngredient,
  ingredientLines,
  mergeIngredients,
  parseIngredient,
  shoppingList,
} from '../shopping';

describe('parseIngredient', () => {
  test('quantidade, unidade e "de"', () => {
    expect(parseIngredient('500 g de carne moída')).toMatchObject({
      name: 'carne moída',
      qty: 500,
      unit: 'g',
    });
  });
  test('kg e litro viram g e ml; vírgula decimal; colado no número', () => {
    expect(parseIngredient('1,5kg arroz')).toMatchObject({ name: 'arroz', qty: 1500, unit: 'g' });
    expect(parseIngredient('2 litros de leite')).toMatchObject({ qty: 2000, unit: 'ml' });
  });
  test('número sem unidade conta unidades, com acento no nome', () => {
    expect(parseIngredient('2 limões')).toMatchObject({ name: 'limões', qty: 2, unit: 'un' });
    expect(parseIngredient('3x pão')).toMatchObject({ name: 'pão', qty: 3, unit: 'un' });
  });
  test('fração e inglês', () => {
    expect(parseIngredient('1/2 kg of beef')).toMatchObject({ name: 'beef', qty: 500, unit: 'g' });
  });
  test('sem quantidade e marcador', () => {
    expect(parseIngredient('- Sal a gosto')).toMatchObject({ name: 'Sal a gosto', qty: null });
    expect(parseIngredient('   ')).toBeNull();
  });
});

describe('mergeIngredients e formatIngredient', () => {
  const items = ['300 g carne', '500 g de Carne', '2 ovos', '4 ovos', 'sal', 'Sal', '1 kg carne'];
  const merged = mergeIngredients(items.map((i) => parseIngredient(i)!));
  test('soma o que combina, sem acento e sem caixa', () => {
    expect(merged.map((m) => formatIngredient(m))).toEqual(['Carne (1,8 kg)', 'Ovos (6)', 'Sal']);
  });
  test('ml e inglês', () => {
    expect(formatIngredient(parseIngredient('250 ml creme')!, 'en')).toBe('Creme (250 ml)');
    expect(formatIngredient(parseIngredient('1.5 l milk')!, 'en')).toBe('Milk (1.5 l)');
  });
});

const task = (
  id: string,
  title: string,
  parent: string | null = null,
  extra: { notes?: string; status?: string; position?: number } = {},
) => ({
  id,
  title,
  parent_task_id: parent,
  notes: extra.notes ?? null,
  status: extra.status ?? 'todo',
  position: extra.position ?? 0,
});

describe('ingredientLines e shoppingList', () => {
  const menu = [
    task('a', 'Lasanha', null, { position: 1 }),
    task('a1', '500 g carne moída', 'a'),
    task('a2', 'Molho', 'a'),
    task('a21', '2 tomates', 'a2'),
    task('b', 'Omelete', null, { position: 2, notes: 'Bater bem.\n- 3 ovos\n- sal' }),
    task('c', 'Bife', null, { position: 3, status: 'done' }),
    task('c1', '300 g carne moída', 'c'),
  ];
  test('folhas e marcadores das notas, sem pratos feitos', () => {
    expect(ingredientLines(menu).sort()).toEqual([
      '- 3 ovos',
      '- sal',
      '2 tomates',
      '500 g carne moída',
    ]);
  });
  test('tudo feito: usa todos', () => {
    const allDone = menu.map((t) => (t.parent_task_id ? t : { ...t, status: 'done' }));
    expect(shoppingList(allDone)).toContain('Carne moída (800 g)');
  });
  test('texto final, uma linha por item', () => {
    expect(shoppingList(menu).split('\n').sort()).toEqual([
      'Carne moída (500 g)',
      'Ovos (3)',
      'Sal',
      'Tomates (2)',
    ]);
  });
});
