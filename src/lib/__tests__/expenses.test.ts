import { describe, expect, it } from '@jest/globals';

import {
  budgetUsed,
  byDateDesc,
  categorySuggestions,
  dateInput,
  defaultCurrency,
  formatMoney,
  inPeriod,
  moneyInput,
  parseExpenseDate,
  parseMoney,
  summarize,
} from '../expenses';

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456],
    ['R$ 12,50', 1250],
    ['12,5', 1250],
    ['12.5', 1250],
    ['1,234.56', 123456],
    ['40', 4000],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['0,99', 99],
    ['US$ 3.00', 300],
  ])('%s → %d', (text, cents) => expect(parseMoney(text)).toBe(cents));
  it.each([[''], ['abc'], ['0'], ['0,00'], ['12,345,6'], ['9999999999999']])(
    '%s é recusado',
    (text) => expect(parseMoney(text)).toBeNull(),
  );
});

describe('formatar', () => {
  it('real em pt-BR', () =>
    expect(formatMoney(123456, 'BRL', 'pt-BR').replace(/\s/g, ' ')).toBe('R$ 1.234,56'));
  it('para editar', () => {
    expect(moneyInput(123456, true)).toBe('1234,56');
    expect(moneyInput(5, false)).toBe('0.05');
  });
  it('moeda do idioma', () => {
    expect(defaultCurrency('pt-BR')).toBe('BRL');
    expect(defaultCurrency('en')).toBe('USD');
    expect(defaultCurrency('es')).toBe('EUR');
  });
});

describe('parseExpenseDate', () => {
  const today = '2026-10-19';
  it.each([
    ['', today],
    ['hoje', today],
    ['ontem', '2026-10-18'],
    ['yesterday', '2026-10-18'],
    ['12/10', '2026-10-12'],
    ['12/10/2025', '2025-10-12'],
    ['5-1-26', '2026-01-05'],
    ['2026-09-30', '2026-09-30'],
  ])('%s → %s', (text, date) => expect(parseExpenseDate(text, today)).toBe(date));
  it('em inglês, mês antes', () =>
    expect(parseExpenseDate('10/12', today, true)).toBe('2026-10-12'));
  it.each([['31/02'], ['amanhã cedo'], ['13/13']])('%s é recusado', (text) =>
    expect(parseExpenseDate(text, today)).toBeNull(),
  );
});

const list = [
  {
    spent_on: '2026-10-02',
    amount_cents: 184000,
    kind: 'out',
    category: 'Material',
    created_at: 'a',
  },
  {
    spent_on: '2026-10-10',
    amount_cents: 30000,
    kind: 'out',
    category: 'Mão de obra',
    created_at: 'b',
  },
  { spent_on: '2026-10-10', amount_cents: 5000, kind: 'in', category: null, created_at: 'c' },
  {
    spent_on: '2026-09-28',
    amount_cents: 20000,
    kind: 'out',
    category: 'Material',
    created_at: 'd',
  },
  { spent_on: '2026-10-11', amount_cents: 1000, kind: 'out', category: null, created_at: 'e' },
];

describe('totais', () => {
  it('do mês', () => {
    const s = summarize(inPeriod(list, 'month', '2026-10-19'));
    expect(s).toEqual({
      spent: 215000,
      received: 5000,
      balance: -210000,
      count: 4,
      byCategory: [
        { category: 'Material', cents: 184000 },
        { category: 'Mão de obra', cents: 30000 },
        { category: '', cents: 1000 },
      ],
    });
  });
  it('de tudo', () => expect(summarize(inPeriod(list, 'all', '2026-10-19')).spent).toBe(235000));
  it('orçamento', () => {
    expect(budgetUsed(250000, 1000000)).toBe(0.25);
    expect(budgetUsed(250000, null)).toBeNull();
  });
});

describe('planilha', () => {
  it('categorias: as usadas primeiro, sem repetir as padrão', () =>
    expect(categorySuggestions(list, ['Material', 'Transporte'])).toEqual([
      'Material',
      'Mão de obra',
      'Transporte',
    ]));
  it('mais recente primeiro; no mesmo dia, o último lançado', () =>
    expect([...list].sort(byDateDesc).map((e) => e.created_at)).toEqual(['e', 'c', 'b', 'a', 'd']));
});

describe('dateInput', () => {
  it('ida e volta', () => {
    expect(dateInput('2026-10-12')).toBe('12/10/2026');
    expect(parseExpenseDate(dateInput('2026-10-12'), '2026-10-19')).toBe('2026-10-12');
    expect(parseExpenseDate(dateInput('2026-10-12', true), '2026-10-19', true)).toBe('2026-10-12');
  });
});
