import { describe, expect, it } from '@jest/globals';

import { checkFormula, computeFormula, parseFormula, type FormulaFieldDef } from '..';

const fields: FormulaFieldDef[] = [
  { id: 'v', name: 'Valor', kind: 'money' },
  { id: 'q', name: 'Quantidade', kind: 'number' },
  { id: 'f', name: 'Fase', kind: 'select' },
  { id: 'd', name: 'Entrega', kind: 'date' },
  { id: 't', name: 'Total', kind: 'formula', formula: '{Valor} * {Quantidade}' },
];

const task = (custom: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  title: 'Tinta',
  status: 'todo',
  priority: 2,
  due_date: '2026-11-25',
  start_date: null,
  estimate_minutes: 30,
  actual_minutes: 0,
  custom,
  ...over,
});

const run = (formula: string, custom?: Record<string, unknown>, over?: Record<string, unknown>) => {
  const field = { id: 'x', name: 'Calc', kind: 'formula' as const, formula };
  const r = computeFormula(field, task(custom, over), [...fields, field], '2026-11-21');
  return r.ok ? r.value : r.error;
};

describe('parseFormula', () => {
  it('precedência, parênteses e sinal', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('-2 * -3')).toBe(6);
    expect(run('10 / 4')).toBe(2.5);
  });
  it('erros de escrita', () => {
    expect(parseFormula('')).toEqual({ ok: false, error: { code: 'empty' } });
    expect(parseFormula('1 +')).toMatchObject({ ok: false, error: { code: 'syntax' } });
    expect(parseFormula('"aberto')).toMatchObject({ ok: false, error: { code: 'unclosed' } });
    expect(parseFormula('{Valor')).toMatchObject({ ok: false, error: { code: 'unclosed' } });
    expect(parseFormula('soma(1)')).toEqual({
      ok: false,
      error: { code: 'unknownFunction', name: 'soma' },
    });
    expect(parseFormula('se(1, 2)')).toEqual({ ok: false, error: { code: 'arity', name: 'se' } });
  });
});

describe('computeFormula', () => {
  it('campos da lista pelo nome, sem acento nem maiúsculas', () => {
    expect(run('{Valor} * {Quantidade}', { v: 12.5, q: 4 })).toBe(50);
    expect(run('{valor} * {QUANTIDADE}', { v: 2, q: 3 })).toBe(6);
    // Vazio contamina; dividir por zero dá vazio
    expect(run('{Valor} * {Quantidade}', { v: 2 })).toBeNull();
    expect(run('{Valor} / 0', { v: 2 })).toBeNull();
  });
  it('as funções nos três idiomas', () => {
    expect(run('dias_ate({vencimento})')).toBe(4);
    expect(run('days_until({due})')).toBe(4);
    expect(run('dias_hasta({vencimiento})')).toBe(4);
    expect(run('se({Fase} = "Compra", 1, 0)', { f: 'compra' })).toBe(1);
    expect(run('if({Fase} = "Compra", 1, 0)', { f: 'Obra' })).toBe(0);
    expect(run('si({Fase} != "Compra", "sim", "não")', { f: 'Obra' })).toBe('sim');
    expect(run('arredondar(10 / 3, 2)')).toBe(3.33);
    expect(run('round(2.5)')).toBe(3);
    expect(run('max(1, {Quantidade}, 7)', { q: 9 })).toBe(9);
    expect(run('min(4, 2)')).toBe(2);
    expect(run('e({prioridade} >= 2, não({concluída}))')).toBe(true);
    expect(run('ou(1 > 2, 2 > 3)')).toBe(false);
    expect(run('vazio({Fase})')).toBe(true);
    expect(run('hoje()')).toBe('2026-11-21');
  });
  it('datas: comparar, somar dias e diferença', () => {
    expect(run('{Entrega} < {vencimento}', { d: '2026-11-22' })).toBe(true);
    expect(run('{vencimento} + 7')).toBe('2026-12-02');
    expect(run('{vencimento} - {Entrega}', { d: '2026-11-20' })).toBe(5);
  });
  it('texto junta com +', () => {
    expect(run('{título} + " x" + {Quantidade}', { q: 3 })).toBe('Tinta x3');
  });
  it('outro campo calculado entra na conta; ciclo é erro', () => {
    expect(run('{Total} + 1', { v: 2, q: 5 })).toBe(11);
    const a = { id: 'a', name: 'A', kind: 'formula' as const, formula: '{B} + 1' };
    const b = { id: 'b', name: 'B', kind: 'formula' as const, formula: '{A} + 1' };
    expect(computeFormula(a, task(), [a, b], '2026-11-21')).toMatchObject({
      ok: false,
      error: { code: 'cycle' },
    });
    expect(run('{Nada} + 1')).toEqual({ code: 'unknownField', name: 'Nada' });
  });
});

describe('checkFormula', () => {
  const self = { id: 'x', name: 'Calc' };
  it('acha nome errado mesmo no ramo que não roda', () => {
    expect(checkFormula('se(1 = 1, 0, {Nada})', self, fields)).toEqual({
      code: 'unknownField',
      name: 'Nada',
    });
    expect(checkFormula('{Total} * 2', self, fields)).toBeNull();
  });
  it('acha ciclo, inclusive com ela mesma', () => {
    expect(checkFormula('{Calc} + 1', self, fields)).toEqual({ code: 'cycle', name: 'Calc' });
    const withLoop: FormulaFieldDef[] = [
      ...fields,
      { id: 'y', name: 'Outro', kind: 'formula', formula: '{Calc} * 2' },
    ];
    expect(checkFormula('{Outro} + 1', self, withLoop)).toMatchObject({ code: 'cycle' });
  });
});
