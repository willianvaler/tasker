import { describe, expect, test } from '@jest/globals';

import { moveToQuadrant, quadrantOf, splitByQuadrant } from '../eisenhower';

const today = '2026-10-20';
const t = (priority: number, due_date: string | null) => ({ priority, due_date });

describe('quadrantOf', () => {
  test('importante e urgente: fazer', () => {
    expect(quadrantOf(t(3, '2026-10-20'), today)).toBe('do');
    expect(quadrantOf(t(2, '2026-10-22'), today)).toBe('do');
  });
  test('atrasada conta como urgente', () => {
    expect(quadrantOf(t(2, '2026-10-01'), today)).toBe('do');
    expect(quadrantOf(t(0, '2026-10-01'), today)).toBe('delegate');
  });
  test('importante sem pressa: agendar', () => {
    expect(quadrantOf(t(2, '2026-10-23'), today)).toBe('plan');
    expect(quadrantOf(t(3, null), today)).toBe('plan');
  });
  test('"!" ainda não é importante', () => {
    expect(quadrantOf(t(1, '2026-10-20'), today)).toBe('delegate');
    expect(quadrantOf(t(1, null), today)).toBe('drop');
  });
});

describe('splitByQuadrant', () => {
  test('mantém a ordem dentro do quadrante', () => {
    const a = { ...t(0, null), id: 'a' };
    const b = { ...t(3, today), id: 'b' };
    const c = { ...t(0, null), id: 'c' };
    const r = splitByQuadrant([a, b, c], today);
    expect(r.drop.map((x) => x.id)).toEqual(['a', 'c']);
    expect(r.do.map((x) => x.id)).toEqual(['b']);
    expect(r.plan).toEqual([]);
  });
});

describe('moveToQuadrant', () => {
  test('já está no quadrante: nada muda', () => {
    expect(moveToQuadrant(t(2, today), 'do', today)).toEqual({});
  });
  test('para "fazer": sobe a prioridade e vence hoje', () => {
    expect(moveToQuadrant(t(0, null), 'do', today)).toEqual({ priority: 2, due_date: today });
  });
  test('prioridade mais alta continua', () => {
    expect(moveToQuadrant(t(3, null), 'do', today)).toEqual({ due_date: today });
  });
  test('tirar a urgência empurra a data uma semana', () => {
    expect(moveToQuadrant(t(2, today), 'plan', today)).toEqual({ due_date: '2026-10-27' });
  });
  test('sem data não ganha data ao ir para "eliminar"', () => {
    expect(moveToQuadrant(t(3, null), 'drop', today)).toEqual({ priority: 0 });
  });
  test('o resultado cai no quadrante pedido', () => {
    for (const task of [t(0, null), t(3, today), t(1, '2026-10-01'), t(2, '2026-11-30')])
      for (const q of ['do', 'plan', 'delegate', 'drop'] as const)
        expect(quadrantOf({ ...task, ...moveToQuadrant(task, q, today) }, today)).toBe(q);
  });
});
