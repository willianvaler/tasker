import { describe, expect, test } from '@jest/globals';

import { balances, settlements, shares, type SplitExpense } from '../split';

const out = (
  paid_by: string,
  amount_cents: number,
  split_among: string[] | null,
  currency = 'BRL',
) => ({ kind: 'out', paid_by, amount_cents, split_among, currency }) satisfies SplitExpense;

describe('shares', () => {
  test('partes iguais, o centavo que sobra vai aos primeiros', () => {
    expect(shares(1000, ['a', 'b', 'c'])).toEqual([
      { person: 'a', cents: 334 },
      { person: 'b', cents: 333 },
      { person: 'c', cents: 333 },
    ]);
  });
});

describe('balances', () => {
  test('quem pagou tem a receber o que os outros devem', () => {
    const b = balances([out('ana', 30000, ['ana', 'bia', 'caio'])]).get('BRL')!;
    expect(Object.fromEntries(b)).toEqual({ ana: 20000, bia: -10000, caio: -10000 });
  });
  test('sem quem pagou ou sem divisão não entra; entrada também não', () => {
    expect(
      balances([
        out('ana', 100, null),
        { ...out('ana', 100, ['bia']), paid_by: null },
        { ...out('ana', 100, ['bia']), kind: 'in' },
      ]).size,
    ).toBe(0);
  });
  test('acerto zera a dívida', () => {
    const b = balances([
      out('ana', 30000, ['ana', 'bia', 'caio']),
      {
        kind: 'settle',
        paid_by: 'bia',
        split_among: ['ana'],
        amount_cents: 10000,
        currency: 'BRL',
      },
    ]).get('BRL')!;
    expect(Object.fromEntries(b)).toEqual({ ana: 10000, bia: 0, caio: -10000 });
  });
  test('cada moeda à parte', () => {
    const b = balances([out('ana', 100, ['ana', 'bia']), out('bia', 300, ['ana', 'bia'], 'USD')]);
    expect(Object.fromEntries(b.get('USD')!)).toEqual({ ana: -150, bia: 150 });
  });
});

describe('settlements', () => {
  test('churrasco: dois pagaram, três dividem', () => {
    const t = settlements(
      balances([
        out('ana', 30000, ['ana', 'bia', 'caio']),
        out('bia', 6000, ['ana', 'bia', 'caio']),
      ]),
    );
    // Cada um deve 12000: Ana pagou 30000 (+18000), Bia 6000 (−6000), Caio nada (−12000)
    expect(t).toEqual([
      { from: 'caio', to: 'ana', cents: 12000, currency: 'BRL' },
      { from: 'bia', to: 'ana', cents: 6000, currency: 'BRL' },
    ]);
  });
  test('tudo acertado: nada a fazer', () => {
    expect(settlements(balances([out('ana', 100, ['ana'])]))).toEqual([]);
  });
  test('a soma das transferências fecha os saldos', () => {
    const list = [
      out('a', 9999, ['a', 'b', 'c', 'd']),
      out('b', 1234, ['b', 'c']),
      out('d', 5000, ['a', 'd']),
    ];
    const b = balances(list).get('BRL')!;
    for (const tr of settlements(balances(list))) {
      b.set(tr.from, (b.get(tr.from) ?? 0) + tr.cents);
      b.set(tr.to, (b.get(tr.to) ?? 0) - tr.cents);
    }
    expect([...b.values()].every((v) => v === 0)).toBe(true);
  });
});
