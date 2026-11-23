import { describe, expect, it } from '@jest/globals';

import {
  bestProjectFor,
  itemCode,
  materialCode,
  matchMaterials,
  materialKindOf,
  materialPath,
  materialTitle,
  MAX_MATERIAL_BYTES,
  planMaterials,
  sortMaterials,
} from '../materials';

describe('materiais', () => {
  it('tipo pelo nome ou pelo mime', () => {
    expect(materialKindOf('03 - M01 - Assis.pdf')).toBe('pdf');
    expect(materialKindOf('arquivo', 'application/pdf')).toBe('pdf');
    expect(materialKindOf('04 - M01 - OpenStax.md')).toBe('markdown');
    expect(materialKindOf('img/torque.PNG')).toBe('image');
    expect(materialKindOf('05 - PhET.html')).toBe('html');
    expect(materialKindOf('material.zip')).toBe('zip');
    expect(materialKindOf('mapa.canvas')).toBe('other');
  });

  it('ordem do nome, com número em ordem de número', () => {
    const list = [{ name: '10 - b' }, { name: '2 - a' }, { name: '01 - c' }];
    expect(sortMaterials(list).map((m) => m.name)).toEqual(['01 - c', '2 - a', '10 - b']);
  });

  it('separa o que entra e o que fica de fora', () => {
    const plan = planMaterials([
      { name: 'a.pdf', size: 1000 },
      { name: 'b.pdf', size: MAX_MATERIAL_BYTES + 1 },
      { name: 'c.md' },
      { name: 'img/x.jpg' },
      { name: 'd.html' },
      { name: 'e.canvas' },
      { name: 'f.zip', size: MAX_MATERIAL_BYTES * 2 },
    ]);
    expect(plan.pdfs.map((f) => f.name)).toEqual(['a.pdf']);
    expect(plan.tooBig.map((f) => f.name)).toEqual(['b.pdf']);
    expect(plan.markdown.map((f) => f.name)).toEqual(['c.md']);
    expect(plan.images.map((f) => f.name)).toEqual(['img/x.jpg']);
    expect(plan.html.map((f) => f.name)).toEqual(['d.html']);
    expect(plan.zips.map((f) => f.name)).toEqual(['f.zip']);
    expect(plan.skipped.map((f) => f.name)).toEqual(['e.canvas']);
  });

  it('caminho e título', () => {
    expect(materialPath('p', 'i')).toBe('p/i.pdf');
    expect(materialPath('p', 'i', 'html')).toBe('p/i.html');
    expect(materialTitle('05 - PhET.html')).toBe('05 - PhET');
    expect(materialTitle('03 - M01 - Assis.pdf')).toBe('03 - M01 - Assis');
  });
});

describe('plano de estudos inteiro (ES8)', () => {
  it('o código, com os mesmos casos do banco (material_tarefas.test.sql)', () => {
    expect(materialCode('03 - M01 - Assis - Arquimedes.pdf')).toBe('m01');
    expect(materialCode('01 - Fase 0 - OpenStax 9.0 - Prelúdio.md')).toBe('fase 0');
    expect(materialCode('LEIA-ME.md')).toBeNull();
    expect(itemCode('Fase 1A · Alavancas e equilíbrio')).toBe('fase 1a');
    expect(itemCode('M01 · Balança de régua')).toBe('m01');
    expect(itemCode('Leia primeiro: como este projeto funciona')).toBeNull();
  });
  it('quantos ligam e qual projeto casa mais', () => {
    const names = ['03 - M01 - Assis.pdf', '01 - Fase 0 - Prelúdio.md', 'LEIA-ME.md'];
    expect(matchMaterials(names, ['M01 · Balança', 'Fase 0 · Começo'])).toEqual({
      linked: 2,
      unlinked: 1,
    });
    expect(
      bestProjectFor(names, [['P01 · Ponte'], ['M01 · Balança'], ['M01 · x', 'Fase 0 · y']]),
    ).toBe(2);
  });
});
