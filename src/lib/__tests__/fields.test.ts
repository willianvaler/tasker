import { describe, expect, it } from '@jest/globals';

import { formatFieldValue, parseFieldInput } from '../fields';

describe('parseFieldInput', () => {
  it.each([
    ['money', '1.200,50', 1200.5],
    ['number', '42', 42],
    ['number', 'abc', undefined],
    ['date', '15/10/2026', '2026-10-15'],
    ['date', 'ontem', undefined],
    ['text', '  oi ', 'oi'],
    ['text', '', null],
  ] as const)('%s "%s" → %s', (kind, text, value) =>
    expect(parseFieldInput(kind, text)).toEqual(value),
  );
});

describe('formatFieldValue', () => {
  it('moeda em real', () =>
    expect(formatFieldValue('money', 1200).replace(/\s/g, ' ')).toBe('R$ 1.200,00'));
  it('pessoa pelo nome', () =>
    expect(formatFieldValue('person', 'u1', 'pt-BR', new Map([['u1', 'Ana']]))).toBe('Ana'));
  it('vazio', () => expect(formatFieldValue('text', null)).toBe(''));
});
