import { describe, expect, test } from '@jest/globals';

import { BUILT_IN_TEMPLATES, templateData } from '../templates';

describe('modelos prontos', () => {
  test('os quatro do escopo existem', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.name)).toEqual([
      'Churrasco',
      'Viagem',
      'Mudança',
      'Festa',
    ]);
  });

  test('Churrasco: carne com subtarefas e prioridade, sem datas', () => {
    const churrasco = BUILT_IN_TEMPLATES.find((t) => t.key === 'churrasco');
    if (!churrasco) throw new Error('sem churrasco');
    const data = templateData(churrasco, '2026-10-09');
    const compras = data.pages[0];
    expect(compras.name).toBe('Compras');
    expect(compras.items[0]).toMatchObject({ title: 'Carne', priority: 2 });
    expect(compras.items[0].children.map((c) => c.title)).toEqual([
      'Picanha',
      'Linguiça',
      'Frango',
    ]);
    expect(compras.items.map((i) => i.title)).toContain('Carvão');
    expect(JSON.stringify(data)).not.toContain('due_date');
  });

  test('todo modelo tem páginas com itens e nenhuma tarefa nasce feita', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const data = templateData(template, '2026-10-09');
      expect(data.pages.length).toBeGreaterThan(0);
      for (const page of data.pages) {
        expect(page.items.length).toBeGreaterThan(0);
        expect(page.items.every((i) => !i.done)).toBe(true);
      }
    }
  });
});
