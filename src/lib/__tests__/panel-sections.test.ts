import { describe, expect, it } from '@jest/globals';

import { showSection, usedSections } from '../panel-sections';

const none = { dependencies: 0, inMyDay: false };

describe('painel simples × completo', () => {
  it('tarefa simples não usa nada avançado', () => {
    const used = usedSections({ custom: {}, weight: null }, none);
    expect([...used]).toEqual([]);
    expect(showSection('simple', used, 'time')).toBe(false);
    expect(showSection('full', used, 'time')).toBe(true);
  });

  it('o que a tarefa já usa aparece mesmo no simples', () => {
    const used = usedSections(
      {
        custom: { a: 'x' },
        approver_role: 'manager',
        estimate_minutes: 30,
        repeat_plan: { sets: 3 },
        weight: 3,
      },
      { dependencies: 1, inMyDay: true },
    );
    for (const s of [
      'dependencies',
      'fields',
      'approval',
      'myDay',
      'time',
      'repeat',
      'weight',
    ] as const)
      expect(showSection('simple', used, s)).toBe(true);
    expect(showSection('simple', used, 'extras')).toBe(false);
  });

  it('campo vazio e peso 1 não contam', () => {
    expect([...usedSections({ custom: { a: null, b: '' }, weight: 1 }, none)]).toEqual([]);
  });
});
