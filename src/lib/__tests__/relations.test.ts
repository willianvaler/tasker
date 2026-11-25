import { describe, expect, test } from '@jest/globals';

import {
  applyRelation,
  computeRollup,
  MAX_ROLLUP,
  parseTyped,
  readSchema,
  relationIds,
  relationValue,
  withInverse,
} from '../relations';

// ED3 (ESCOPO_V16): propriedades tipadas, relação bidirecional e rollup.

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const nota = (i: number, props: Record<string, unknown> = {}) => ({
  id: uuid(i),
  title: `Nota ${i}`,
  props,
});

describe('esquema', () => {
  test('lê só tipos conhecidos, até 50', () => {
    const raw = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`p${i}`, { tipo: 'numero' }]),
    );
    expect(Object.keys(readSchema(raw))).toHaveLength(50);
    expect(readSchema({ a: { tipo: 'x' }, b: { tipo: 'rollup', funcao: 'soma?' } })).toEqual({
      b: { tipo: 'rollup', funcao: 'count' },
    });
  });
});

describe('relação', () => {
  test('ida e volta do valor guardado', () => {
    const v = relationValue([{ id: uuid(1), title: 'Livro [x]' }]);
    expect(v).toEqual([`[[Livro  x |n:${uuid(1)}]]`]);
    expect(relationIds(v)).toEqual([uuid(1)]);
  });

  test('bidirecional: entra e sai da inversa', () => {
    const notas = [nota(1), nota(2), nota(3)];
    const r = applyRelation(notas, uuid(1), 'Autores', [uuid(2), uuid(3)], 'Livros');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const props = Object.fromEntries(r.patches.map((p) => [p.id, p.props]));
    expect(relationIds(props[uuid(1)].Autores)).toEqual([uuid(2), uuid(3)]);
    expect(relationIds(props[uuid(2)].Livros)).toEqual([uuid(1)]);
    // Tirar a 3: ela perde a inversa
    const depois = notas.map((n) => ({ ...n, props: props[n.id] ?? n.props }));
    const r2 = applyRelation(depois, uuid(1), 'Autores', [uuid(2)], 'Livros');
    if (!r2.ok) throw new Error();
    expect(r2.patches.map((p) => p.id).sort()).toEqual([uuid(1), uuid(3)].sort());
    expect(r2.patches.find((p) => p.id === uuid(3))?.props.Livros).toBeUndefined();
  });

  test('até 500 relações por página', () => {
    const notas = Array.from({ length: 502 }, (_, i) => nota(i));
    expect(
      applyRelation(
        notas,
        uuid(0),
        'R',
        notas.slice(1).map((n) => n.id),
      ),
    ).toEqual({ ok: false, erro: 'demais' });
  });

  test('a inversa no esquema da outra base, sem repetir', () => {
    expect(withInverse({}, 'Livros', uuid(9), 'Autores')).toEqual({
      Livros: { tipo: 'relacao', base: uuid(9), inversa: 'Autores' },
    });
    expect(withInverse({ Livros: { tipo: 'relacao' } }, 'Livros', uuid(9), 'Autores')).toBeNull();
  });
});

describe('rollup', () => {
  test('soma sobre 1.000 relacionadas fecha com a conta direta', () => {
    const rel = Array.from({ length: 1000 }, (_, i) => nota(i + 1, { horas: (i % 7) + 0.5 }));
    const pai = nota(0, { Tarefas: relationValue(rel) });
    const byId = new Map([pai, ...rel].map((n) => [n.id, n]));
    const direta = rel.reduce((s, n) => s + (n.props.horas as number), 0);
    expect(
      computeRollup(
        pai,
        { tipo: 'rollup', relacao: 'Tarefas', propriedade: 'horas', funcao: 'sum' },
        byId,
      ),
    ).toEqual({ ok: true, value: direta });
    expect(
      computeRollup(pai, { tipo: 'rollup', relacao: 'tarefas', funcao: 'count' }, byId),
    ).toEqual({ ok: true, value: 1000 });
    expect(
      computeRollup(
        pai,
        { tipo: 'rollup', relacao: 'Tarefas', propriedade: 'horas', funcao: 'max' },
        byId,
      ),
    ).toEqual({ ok: true, value: 6.5 });
  });

  test('acima de 5.000 relacionadas: muitas relações', () => {
    const ids = Array.from({ length: MAX_ROLLUP + 1 }, (_, i) => `[[x|n:${uuid(i)}]]`);
    expect(
      computeRollup(
        nota(0, { R: ids }),
        { tipo: 'rollup', relacao: 'R', funcao: 'count' },
        new Map(),
      ),
    ).toEqual({ ok: false, erro: 'muitas' });
  });

  test('% concluído e lista', () => {
    const rel = [nota(1, { feito: true, tag: ['a'] }), nota(2, { feito: false, tag: ['a', 'b'] })];
    const pai = nota(0, { R: relationValue(rel) });
    const byId = new Map([pai, ...rel].map((n) => [n.id, n]));
    expect(
      computeRollup(
        pai,
        { tipo: 'rollup', relacao: 'R', propriedade: 'feito', funcao: 'done' },
        byId,
      ),
    ).toEqual({ ok: true, value: 50 });
    expect(
      computeRollup(
        pai,
        { tipo: 'rollup', relacao: 'R', propriedade: 'tag', funcao: 'list' },
        byId,
      ),
    ).toEqual({ ok: true, value: 'a, b' });
  });
});

describe('célula tipada', () => {
  test('cada tipo valida o que aceita', () => {
    expect(parseTyped({ tipo: 'numero' }, '3,5')).toEqual({ ok: true, value: 3.5 });
    expect(parseTyped({ tipo: 'url' }, 'exemplo.com')).toEqual({ ok: false });
    expect(parseTyped({ tipo: 'selecao', opcoes: ['Lendo', 'Lido'] }, 'lido')).toEqual({
      ok: true,
      value: 'Lido',
    });
    expect(parseTyped({ tipo: 'selecao', opcoes: ['Lendo'] }, 'Outro')).toEqual({ ok: false });
    expect(parseTyped({ tipo: 'multi', opcoes: ['a', 'b'] }, 'A, b, a')).toEqual({
      ok: true,
      value: ['a', 'b'],
    });
    expect(parseTyped({ tipo: 'relacao' }, 'nota 2', [nota(1), nota(2)])).toEqual({
      ok: true,
      value: [uuid(2)],
    });
    expect(parseTyped({ tipo: 'relacao' }, 'Nenhuma', [nota(1)])).toEqual({ ok: false });
    expect(parseTyped({ tipo: 'rollup' }, '3')).toEqual({ ok: false });
  });
});
