import { describe, expect, it } from '@jest/globals';

import { addableSections, showSection, usedSections } from '../panel-sections';

const none = { inMyDay: false };
const empty = new Set<never>();

describe('painel por uso (D265)', () => {
  it('tarefa simples não usa nada avançado', () => {
    const used = usedSections({ weight: null, visibility: 'private' }, none);
    expect([...used]).toEqual([]);
    expect(showSection(false, used, empty, 'time')).toBe(false);
    // "Mostrar todas as seções" ligado
    expect(showSection(true, used, empty, 'time')).toBe(true);
  });

  it('o que a tarefa já usa aparece sem pedir', () => {
    const used = usedSections(
      {
        approver_role: 'manager',
        estimate_minutes: 30,
        repeat_plan: { sets: 3 },
        recurrence: { type: 'daily' },
        weight: 3,
        visibility: 'friends',
      },
      { inMyDay: true, attachments: 2 },
    );
    for (const s of [
      'approval',
      'myDay',
      'time',
      'repeat',
      'recurrence',
      'weight',
      'visibility',
      'attachments',
    ] as const)
      expect(showSection(false, used, empty, s)).toBe(true);
    expect(showSection(false, used, empty, 'extras')).toBe(false);
  });

  it('peso 1, privada e sem anexos não contam', () => {
    expect([
      ...usedSections({ weight: 1, visibility: 'private' }, { ...none, attachments: 0 }),
    ]).toEqual([]);
  });

  it('adicionar mostra a seção e tira do menu', () => {
    const available = new Set(['time', 'weight', 'extras'] as const);
    const used = usedSections({}, none);
    expect(addableSections(available, false, used, empty)).toEqual(['time', 'weight', 'extras']);
    const added = new Set(['weight'] as const);
    expect(showSection(false, used, added, 'weight')).toBe(true);
    expect(addableSections(available, false, used, added)).toEqual(['time', 'extras']);
    // Com tudo à vista, o menu fica vazio
    expect(addableSections(available, true, used, empty)).toEqual([]);
  });
});
