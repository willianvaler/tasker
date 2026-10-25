import { describe, expect, it } from '@jest/globals';

import { dishDays, ingredientList, mealOf, todaysMeals, weekGrid } from '../diet';

const dish = (id: string, days: number[] | null, meal?: string, position = 1) => ({
  id,
  title: id,
  parent_task_id: null,
  position,
  meta: { ...(meal ? { meal } : {}), ...(days ? { days } : {}) },
  status: 'todo',
});

describe('dieta (BE2)', () => {
  it('refeição do meta, almoço se faltar ou for estranha', () => {
    expect(mealOf({ meta: { meal: 'dinner' } })).toBe('dinner');
    expect(mealOf({ meta: { meal: 'brunch' } })).toBe('lunch');
    expect(mealOf({ meta: null })).toBe('lunch');
  });

  it('dias do prato no meta, sem repetir e em ordem', () => {
    expect(dishDays({ meta: { days: [3, 1, 3] } })).toEqual([1, 3]);
    expect(dishDays({ meta: { days: [9, 'x'] } })).toEqual([]);
    expect(dishDays({ meta: null })).toEqual([]);
  });

  it('grade da semana e pratos de hoje na ordem das refeições', () => {
    const tasks = [
      dish('Frango', [1, 3], 'lunch', 2),
      dish('Ovos', [1], 'breakfast', 3),
      dish('Sopa', [1], 'dinner', 1),
      dish('Sem dia', null),
      { ...dish('Arroz', null), parent_task_id: 'Frango' },
    ];
    const { grid, loose } = weekGrid(tasks);
    expect(grid.get(3)?.lunch.map((d) => d.id)).toEqual(['Frango']);
    expect(loose.map((d) => d.id)).toEqual(['Sem dia']);
    expect(todaysMeals(tasks, '2026-10-26').map((m) => `${m.meal}:${m.dish.id}`)).toEqual([
      'breakfast:Ovos',
      'lunch:Frango',
      'dinner:Sopa',
    ]);
    expect(todaysMeals(tasks, '2026-10-27')).toEqual([]);
  });

  it('ingredientes um por linha', () => {
    expect(ingredientList('- 500 g de frango\n\n• arroz\n  feijão ')).toEqual([
      '500 g de frango',
      'arroz',
      'feijão',
    ]);
  });
});
