import { tr } from './i18n-ref';

// Orçamento do projeto (GP4, D316): o que vem do `project_budget` (centavos inteiros, na moeda do
// projeto) e o CSV para baixar. A conta é do servidor (o valor da hora de cada pessoa não sai dele
// para quem não pode ver); aqui só se arruma e se exporta.

export type BudgetPage = {
  id: string;
  name: string;
  view_type: string;
  work_planned: number;
  work_actual: number;
  expenses_planned: number;
  expenses_actual: number;
};
export type BudgetPerson = {
  user_id: string;
  name: string | null;
  minutes: number;
  cents: number | null;
};
export type ProjectBudget = {
  currency: string;
  manager: boolean;
  default_rate: number | null;
  work_planned: number;
  work_actual: number;
  expenses_planned: number;
  expenses_actual: number;
  other_currency: number;
  pages: BudgetPage[];
  people: BudgetPerson[];
};

export const budgetTotals = (b: ProjectBudget) => ({
  planned: b.work_planned + b.expenses_planned,
  actual: b.work_actual + b.expenses_actual,
});

/** Fração realizada do previsto (0 quando não há previsto); passa de 1 quando estoura. */
export const spentRatio = (planned: number, actual: number) => (planned > 0 ? actual / planned : 0);

const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const cell = (value: string | number | null) => {
  const text = value == null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV com ";" e BOM (abre no Excel em pt-BR), por lista e, embaixo, por pessoa. */
export function budgetCsv(b: ProjectBudget) {
  const head = [
    tr('budget.csv.list'),
    tr('budget.csv.workPlanned'),
    tr('budget.csv.workActual'),
    tr('budget.csv.expensesPlanned'),
    tr('budget.csv.expensesActual'),
  ];
  const lines = [head.join(';')];
  for (const p of b.pages)
    lines.push(
      [
        p.name,
        money(p.work_planned),
        money(p.work_actual),
        money(p.expenses_planned),
        money(p.expenses_actual),
      ]
        .map(cell)
        .join(';'),
    );
  lines.push(
    [
      tr('budget.csv.total'),
      money(b.work_planned),
      money(b.work_actual),
      money(b.expenses_planned),
      money(b.expenses_actual),
    ]
      .map(cell)
      .join(';'),
  );
  if (b.people.length) {
    lines.push(
      '',
      [tr('budget.csv.person'), tr('budget.csv.minutes'), tr('budget.csv.cost')].join(';'),
    );
    for (const p of b.people)
      lines.push(
        [p.name ?? '', p.minutes, p.cents == null ? '' : money(p.cents)].map(cell).join(';'),
      );
  }
  lines.push('', `${tr('budget.csv.currency')};${b.currency}`);
  return `﻿${lines.join('\r\n')}\r\n`;
}
