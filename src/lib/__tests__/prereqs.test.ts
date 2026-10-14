import { describe, expect, test } from '@jest/globals';

import { parseQuickInput } from '../parser/quick';
import { prereqToken, resolveBatchPrereq, resolvePrereq } from '../prereqs';

const project = [
  { id: 'c', title: 'Comprar carvão' },
  { id: 'g', title: 'Comprar gelo' },
  { id: 'f', title: 'Acender o fogo' },
];

describe('^ na captura', () => {
  test('o parser tira o ^ do título só quando ligado', () => {
    const on = parseQuickInput('Acender o fogo @willian ^carvão', {
      today: '2026-10-14',
      mentions: true,
      prereqs: true,
    });
    expect(on.title).toBe('Acender o fogo');
    expect(on.prereqs).toEqual(['carvão']);
    expect(parseQuickInput('nota ^1', { today: '2026-10-14' }).title).toBe('nota ^1');
  });

  test('resolve por trecho, sem acento; ambíguo não liga', () => {
    expect(resolvePrereq('carvao', project)).toMatchObject({ kind: 'task', id: 'c' });
    expect(resolvePrereq('comprar', project)).toMatchObject({ kind: 'ambiguous' });
    expect(resolvePrereq('pão', project)).toEqual({ kind: 'none', term: 'pão' });
  });

  test('o título inteiro vence mesmo que seja trecho de outro', () => {
    const list = [
      { id: 'a', title: 'Gelo' },
      { id: 'b', title: 'Gelo seco' },
    ];
    expect(resolvePrereq('gelo', list)).toMatchObject({ kind: 'task', id: 'a' });
  });

  test('o token do autocomplete acha só a tarefa escolhida', () => {
    expect(prereqToken('Comprar carvão!')).toBe('Comprarcarvão');
    for (const t of project)
      expect(resolvePrereq(prereqToken(t.title), project)).toMatchObject({ id: t.id });
  });
});

describe('^ no lote', () => {
  const batch = [
    { id: 'b1', title: 'Comprar carne' },
    { id: 'b2', title: 'Temperar' },
    { id: 'b3', title: 'Assar' },
  ];

  test('^2 é o item 2 do lote; ^N fora do lote ou ele mesmo não vale', () => {
    expect(resolveBatchPrereq('2', 'b3', batch, project)).toMatchObject({ kind: 'task', id: 'b2' });
    expect(resolveBatchPrereq('9', 'b3', batch, project).kind).toBe('none');
    expect(resolveBatchPrereq('3', 'b3', batch, project).kind).toBe('none');
  });

  test('trecho procura primeiro no lote, depois no projeto', () => {
    expect(resolveBatchPrereq('carne', 'b3', batch, project)).toMatchObject({ id: 'b1' });
    expect(resolveBatchPrereq('carvão', 'b3', batch, project)).toMatchObject({ id: 'c' });
  });
});
