import { describe, expect, test } from '@jest/globals';

import { showInWorkout, usedExtras } from '../fields';

describe('usedExtras', () => {
  test('item limpo não usa nada', () => {
    expect(usedExtras({ priority: 0, labels: [], visibility: 'private', weight: null }).size).toBe(
      0,
    );
  });
  test('o que já tem valor aparece', () => {
    const used = usedExtras(
      { due_date: '2026-10-20', priority: 2, labels: ['perna'], custom: { a: '' } },
      { comments: 1, subtasks: 0 },
    );
    expect([...used].sort()).toEqual(['comments', 'due', 'labels', 'priority']);
  });
});

describe('showInWorkout', () => {
  const used = new Set(['due'] as const);
  test('fora de treino, sempre', () => {
    expect(showInWorkout('labels', { workout: false, more: false, used: new Set() })).toBe(true);
  });
  test('no treino, só o usado, até abrir Mais opções', () => {
    expect(showInWorkout('labels', { workout: true, more: false, used })).toBe(false);
    expect(showInWorkout('due', { workout: true, more: false, used })).toBe(true);
    expect(showInWorkout('labels', { workout: true, more: true, used })).toBe(true);
  });
});
