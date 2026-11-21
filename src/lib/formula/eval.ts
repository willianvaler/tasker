import { diffDays } from '../gantt';
import type { IsoDate } from '../parser/dates';
import type { FormulaNode } from './parse';

// Calcula a árvore da fórmula (VS2, D318). O valor é sempre do app, nunca guardado: o banco tem os
// valores dos outros campos e a fórmula só lê. Vazio (null) contamina a conta (1 + vazio = vazio),
// como numa planilha que não inventa zero; divisão por zero também dá vazio.

export type FormulaValue = number | string | boolean | null;

export type EvalError = { code: 'unknownField'; name: string } | { code: 'cycle'; name: string };

export class FormulaFail extends Error {
  constructor(readonly error: EvalError) {
    super(error.code);
  }
}

export type EvalContext = {
  today: IsoDate;
  /** O valor de `{nome}`; undefined = esse campo não existe (lança FormulaFail) */
  field: (name: string) => FormulaValue | undefined;
};

const isDate = (v: FormulaValue): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const num = (v: FormulaValue): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

const truthy = (v: FormulaValue) =>
  v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v !== '');

function compare(op: string, a: FormulaValue, b: FormulaValue): boolean | null {
  if (op === '=' || op === '!=') {
    const eq =
      typeof a === 'string' && typeof b === 'string'
        ? a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
        : (a ?? null) === (b ?? null) || (num(a) !== null && num(a) === num(b));
    return op === '=' ? eq : !eq;
  }
  if (a === null || b === null) return null;
  const x = isDate(a) && isDate(b) ? a : num(a);
  const y = isDate(a) && isDate(b) ? b : num(b);
  if (x === null || y === null) return null;
  if (op === '<') return x < y;
  if (op === '>') return x > y;
  if (op === '<=') return x <= y;
  return x >= y;
}

export function evaluate(node: FormulaNode, ctx: EvalContext): FormulaValue {
  const run = (n: FormulaNode) => evaluate(n, ctx);
  switch (node.type) {
    case 'number':
    case 'string':
      return node.value;
    case 'field': {
      const v = ctx.field(node.name);
      if (v === undefined) throw new FormulaFail({ code: 'unknownField', name: node.name });
      return v;
    }
    case 'neg': {
      const v = num(run(node.arg));
      return v === null ? null : -v;
    }
    case 'binary': {
      const a = run(node.left);
      const b = run(node.right);
      if (['=', '!=', '<', '>', '<=', '>='].includes(node.op)) return compare(node.op, a, b);
      // Texto + texto junta (com número também: "Lote " + 3)
      if (node.op === '+' && (typeof a === 'string' || typeof b === 'string') && !isDate(a))
        return a === null || b === null ? null : `${a}${b}`;
      // Data ± dias
      if ((node.op === '+' || node.op === '-') && isDate(a) && num(b) !== null) {
        const d = new Date(`${a}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + (node.op === '+' ? 1 : -1) * (num(b) as number));
        return d.toISOString().slice(0, 10);
      }
      // Data − data = dias
      if (node.op === '-' && isDate(a) && isDate(b)) return diffDays(b, a);
      const x = num(a);
      const y = num(b);
      if (x === null || y === null) return null;
      if (node.op === '+') return x + y;
      if (node.op === '-') return x - y;
      if (node.op === '*') return x * y;
      return y === 0 ? null : x / y;
    }
    case 'call': {
      const args = node.args;
      switch (node.fn) {
        case 'if':
          return truthy(run(args[0])) ? run(args[1]) : run(args[2]);
        case 'today':
          return ctx.today;
        case 'daysUntil': {
          const d = run(args[0]);
          return isDate(d) ? diffDays(ctx.today, d) : null;
        }
        case 'round': {
          const v = num(run(args[0]));
          const places = args[1] ? (num(run(args[1])) ?? 0) : 0;
          if (v === null) return null;
          const f = 10 ** Math.max(0, Math.min(6, Math.trunc(places)));
          return Math.round(v * f) / f;
        }
        case 'min':
        case 'max': {
          const values = args.map((a) => num(run(a))).filter((v): v is number => v !== null);
          if (!values.length) return null;
          return node.fn === 'min' ? Math.min(...values) : Math.max(...values);
        }
        case 'abs': {
          const v = num(run(args[0]));
          return v === null ? null : Math.abs(v);
        }
        case 'and':
          return args.every((a) => truthy(run(a)));
        case 'or':
          return args.some((a) => truthy(run(a)));
        case 'not':
          return !truthy(run(args[0]));
        case 'empty': {
          const v = run(args[0]);
          return v === null || v === '';
        }
      }
    }
  }
  return null;
}
