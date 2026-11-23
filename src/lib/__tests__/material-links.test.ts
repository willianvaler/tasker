import { describe, expect, it } from '@jest/globals';

import { materialsForTask, type MaterialLinkRow } from '../material-links';

const row = (name: string, kind: string, target: string, auto = true): MaterialLinkRow => ({
  material_id: name,
  material_name: name,
  material_folder_id: 'f',
  note_id: null,
  mime: 'application/pdf',
  target_kind: kind,
  target_id: target,
  target_title: target,
  target_folder_id: 'f',
  auto,
});
const rows = [
  row('04 - M01 - OpenStax', 'task', 'm01'),
  row('03 - M01 - Assis', 'task', 'm01'),
  row('03 - M01 - Assis', 'task', 'm01', false),
  row('01 - Fase 0 - Prelúdio', 'page', 'fase0'),
];

describe('material da tarefa (ES6)', () => {
  it('o da própria tarefa, na ordem do nome e sem repetir', () => {
    expect(
      materialsForTask(rows, { id: 'm01', page_id: 'fase1' }).map((m) => [m.material_name, m.via]),
    ).toEqual([
      ['03 - M01 - Assis', 'task'],
      ['04 - M01 - OpenStax', 'task'],
    ]);
  });
  it('a sessão herda da tarefa mãe', () => {
    const list = materialsForTask(rows, { id: 's1', page_id: 'fase1', ancestors: ['x', 'm01'] });
    expect(list.map((m) => m.via)).toEqual(['parent', 'parent']);
  });
  it('sem nada na tarefa nem nas mães: o da lista', () => {
    expect(
      materialsForTask(rows, { id: 't', page_id: 'fase0' }).map((m) => [m.material_name, m.via]),
    ).toEqual([['01 - Fase 0 - Prelúdio', 'page']]);
    expect(materialsForTask(rows, { id: 't', page_id: 'outra' })).toEqual([]);
  });
});
