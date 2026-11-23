import { describe, expect, it } from '@jest/globals';

import {
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
