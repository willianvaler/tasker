import { fold } from '../query/parse';

// Campo calculado (VS2, ESCOPO_V12 §8, D318): uma linguagem pequena e fechada, sem JavaScript.
// `{Valor} * {Quantidade}`, `dias_ate({vencimento})`, `se({Fase} = "Compra", 1, 0)`. Os nomes das
// funções valem nos três idiomas (pt-BR, en, es), sem acento e sem diferença de maiúsculas.
// Aqui: texto → árvore. Quem calcula é o `eval.ts`.

export type FormulaFn =
  'if' | 'daysUntil' | 'today' | 'round' | 'min' | 'max' | 'abs' | 'and' | 'or' | 'not' | 'empty';

/** Nome da função em cada idioma → a função */
const FUNCTIONS: Record<string, FormulaFn> = {};
const names: [FormulaFn, string[]][] = [
  ['if', ['se', 'if', 'si']],
  ['daysUntil', ['dias_ate', 'days_until', 'dias_hasta']],
  ['today', ['hoje', 'today', 'hoy']],
  ['round', ['arredondar', 'round', 'redondear']],
  ['min', ['min', 'minimo']],
  ['max', ['max', 'maximo']],
  ['abs', ['abs']],
  ['and', ['e', 'and', 'y']],
  ['or', ['ou', 'or', 'o']],
  ['not', ['nao', 'not', 'no']],
  ['empty', ['vazio', 'empty', 'vacio']],
];
for (const [fn, list] of names) for (const n of list) FUNCTIONS[fold(n)] = fn;

/** Quantos argumentos cada função aceita: [mínimo, máximo] */
export const ARITY: Record<FormulaFn, [number, number]> = {
  if: [3, 3],
  daysUntil: [1, 1],
  today: [0, 0],
  round: [1, 2],
  min: [1, 20],
  max: [1, 20],
  abs: [1, 1],
  and: [2, 20],
  or: [2, 20],
  not: [1, 1],
  empty: [1, 1],
};

export type BinaryOp = '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '>' | '<=' | '>=';

export type FormulaNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'field'; name: string }
  | { type: 'neg'; arg: FormulaNode }
  | { type: 'binary'; op: BinaryOp; left: FormulaNode; right: FormulaNode }
  | { type: 'call'; fn: FormulaFn; args: FormulaNode[] };

export type FormulaError =
  | { code: 'empty' }
  | { code: 'syntax'; at: number }
  | { code: 'unclosed'; at: number }
  | { code: 'unknownFunction'; name: string }
  | { code: 'arity'; name: string }
  | { code: 'tooLong' };

export type FormulaParse = { ok: true; node: FormulaNode } | { ok: false; error: FormulaError };

export const MAX_FORMULA = 500;

type Token =
  | { t: 'num'; v: number; at: number }
  | { t: 'str'; v: string; at: number }
  | { t: 'field'; v: string; at: number }
  | { t: 'name'; v: string; at: number }
  | { t: 'op'; v: string; at: number }
  | { t: 'end'; at: number };

class Fail extends Error {
  constructor(readonly error: FormulaError) {
    super(error.code);
  }
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const at = i;
    // Número: 12, 1.5, 1,5 não (a vírgula separa argumentos)
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ t: 'num', v: Number(num[0]), at });
      i += num[0].length;
      continue;
    }
    if (c === '"' || c === '“' || c === '”') {
      const end = src.slice(i + 1).search(/["“”]/);
      if (end < 0) throw new Fail({ code: 'unclosed', at });
      tokens.push({ t: 'str', v: src.slice(i + 1, i + 1 + end), at });
      i += end + 2;
      continue;
    }
    if (c === '{') {
      const end = src.indexOf('}', i);
      if (end < 0) throw new Fail({ code: 'unclosed', at });
      const name = src.slice(i + 1, end).trim();
      if (!name) throw new Fail({ code: 'syntax', at });
      tokens.push({ t: 'field', v: name, at });
      i = end + 1;
      continue;
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
    if (word) {
      tokens.push({ t: 'name', v: word[0], at });
      i += word[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ t: 'op', v: two === '<>' ? '!=' : two === '==' ? '=' : two, at });
      i += 2;
      continue;
    }
    if ('+-*/=<>(),'.includes(c)) {
      tokens.push({ t: 'op', v: c, at });
      i++;
      continue;
    }
    throw new Fail({ code: 'syntax', at });
  }
  tokens.push({ t: 'end', at: src.length });
  return tokens;
}

/** Texto da fórmula → árvore (ou o erro, com a posição quando dá). */
export function parseFormula(src: string): FormulaParse {
  const text = src.trim();
  if (!text) return { ok: false, error: { code: 'empty' } };
  if (text.length > MAX_FORMULA) return { ok: false, error: { code: 'tooLong' } };
  try {
    const tokens = tokenize(text);
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v: string) => {
      const tk = peek();
      return tk.t === 'op' && tk.v === v;
    };
    const expect = (v: string) => {
      if (!isOp(v)) throw new Fail({ code: 'syntax', at: peek().at });
      pos++;
    };

    // Precedência: comparação < soma < produto < sinal < átomo
    const comparison = (): FormulaNode => {
      let left = additive();
      for (;;) {
        const tk = peek();
        if (tk.t === 'op' && ['=', '!=', '<', '>', '<=', '>='].includes(tk.v)) {
          pos++;
          left = { type: 'binary', op: tk.v as BinaryOp, left, right: additive() };
        } else return left;
      }
    };
    const additive = (): FormulaNode => {
      let left = multiplicative();
      for (;;) {
        const tk = peek();
        if (tk.t === 'op' && (tk.v === '+' || tk.v === '-')) {
          pos++;
          left = { type: 'binary', op: tk.v, left, right: multiplicative() };
        } else return left;
      }
    };
    const multiplicative = (): FormulaNode => {
      let left = unary();
      for (;;) {
        const tk = peek();
        if (tk.t === 'op' && (tk.v === '*' || tk.v === '/')) {
          pos++;
          left = { type: 'binary', op: tk.v, left, right: unary() };
        } else return left;
      }
    };
    const unary = (): FormulaNode => {
      if (isOp('-')) {
        pos++;
        return { type: 'neg', arg: unary() };
      }
      if (isOp('+')) {
        pos++;
        return unary();
      }
      return atom();
    };
    const atom = (): FormulaNode => {
      const tk = peek();
      pos++;
      if (tk.t === 'num') return { type: 'number', value: tk.v };
      if (tk.t === 'str') return { type: 'string', value: tk.v };
      if (tk.t === 'field') return { type: 'field', name: tk.v };
      if (tk.t === 'op' && tk.v === '(') {
        const inner = comparison();
        expect(')');
        return inner;
      }
      if (tk.t === 'name') {
        const fn = FUNCTIONS[fold(tk.v)];
        if (!fn) throw new Fail({ code: 'unknownFunction', name: tk.v });
        expect('(');
        const args: FormulaNode[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) {
            pos++;
            args.push(comparison());
          }
        }
        expect(')');
        const [min, max] = ARITY[fn];
        if (args.length < min || args.length > max) throw new Fail({ code: 'arity', name: tk.v });
        return { type: 'call', fn, args };
      }
      throw new Fail({ code: 'syntax', at: tk.at });
    };

    const node = comparison();
    if (peek().t !== 'end') throw new Fail({ code: 'syntax', at: peek().at });
    return { ok: true, node };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error };
    throw e;
  }
}

/** Os campos que a fórmula usa (para achar ciclo e avisar de nome que não existe). */
export function formulaFields(node: FormulaNode): string[] {
  switch (node.type) {
    case 'field':
      return [node.name];
    case 'neg':
      return formulaFields(node.arg);
    case 'binary':
      return [...formulaFields(node.left), ...formulaFields(node.right)];
    case 'call':
      return node.args.flatMap(formulaFields);
    default:
      return [];
  }
}
