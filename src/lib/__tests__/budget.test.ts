import { describe, expect, it } from '@jest/globals';

import { budgetCsv, budgetTotals, spentRatio, type ProjectBudget } from '../budget';

const budget: ProjectBudget = {
  currency: 'BRL',
  manager: true,
  default_rate: 6000,
  work_planned: 15000,
  work_actual: 6000,
  expenses_planned: 50000,
  expenses_actual: 20000,
  other_currency: 0,
  pages: [
    {
      id: 'p',
      name: 'Entregas; fase 1',
      view_type: 'list',
      work_planned: 15000,
      work_actual: 6000,
      expenses_planned: 0,
      expenses_actual: 0,
    },
  ],
  people: [
    { user_id: 'u', name: 'Bia', minutes: 30, cents: 6000 },
    { user_id: 'v', name: 'Caio', minutes: 10, cents: null },
  ],
};

describe('orçamento', () => {
  it('totais e fração gasta', () => {
    expect(budgetTotals(budget)).toEqual({ planned: 65000, actual: 26000 });
    expect(spentRatio(100, 150)).toBe(1.5);
    expect(spentRatio(0, 10)).toBe(0);
  });
  it('CSV por lista e por pessoa, com ";" e BOM; custo escondido fica vazio', () => {
    const csv = budgetCsv(budget);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '﻿Lista;Trabalho previsto;Trabalho realizado;Gastos previstos;Gastos realizados',
      '"Entregas; fase 1";150,00;60,00;0,00;0,00',
      'Total;150,00;60,00;500,00;200,00',
      '',
      'Pessoa;Minutos;Custo',
      'Bia;30;60,00',
      'Caio;10;',
      '',
      'Moeda;BRL',
      '',
    ]);
  });
});
