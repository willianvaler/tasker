// Linguagem de expressões compartilhada (FN0, ESCOPO_V16 PR3, D344): a mesma do campo calculado
// (VS2, ESCOPO_V12 §8, D318), agora num módulo sem imports para rodar no app (src/lib/formula e
// src/lib/expr) e na Edge Function dos processos, com os mesmos resultados (teste de paridade).
// `{Valor} * {Quantidade}`, `dias_ate({vencimento})`, `se({Fase} = "Compra", 1, 0)`. Os nomes das
// funções valem nos três idiomas (pt-BR, en, es), sem acento e sem diferença de maiúsculas. Fechada:
// sem JavaScript, sem laço livre, sem acesso ao banco ou à rede, e com orçamento de operações.

/** Sem acento e em minúsculas (o mesmo `fold` de src/lib/query/parse.ts). */
export function fold(word: string) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const MS_DAY = 86_400_000;
/** Dias de a até b (o mesmo `diffDays` de src/lib/gantt.ts). */
export const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_DAY);

// ---------------------------------------------------------------------------------------------
// Árvore
// ---------------------------------------------------------------------------------------------

export type FormulaFn =
  | 'if'
  | 'daysUntil'
  | 'today'
  | 'now'
  | 'round'
  | 'min'
  | 'max'
  | 'abs'
  | 'and'
  | 'or'
  | 'not'
  | 'empty'
  | 'length'
  | 'contains';

/** Nome da função em cada idioma → a função */
const FUNCTIONS: Record<string, FormulaFn> = {};
const names: [FormulaFn, string[]][] = [
  ['if', ['se', 'if', 'si']],
  ['daysUntil', ['dias_ate', 'days_until', 'dias_hasta']],
  ['today', ['hoje', 'today', 'hoy']],
  ['now', ['agora', 'now', 'ahora']],
  ['round', ['arredondar', 'arredonda', 'round', 'redondear']],
  ['min', ['min', 'minimo']],
  ['max', ['max', 'maximo']],
  ['abs', ['abs']],
  ['and', ['e', 'and', 'y']],
  ['or', ['ou', 'or', 'o']],
  ['not', ['nao', 'not', 'no']],
  ['empty', ['vazio', 'empty', 'vacio']],
  ['length', ['tamanho', 'length', 'longitud']],
  ['contains', ['contem', 'contains', 'contiene']],
];
for (const [fn, list] of names) for (const n of list) FUNCTIONS[fold(n)] = fn;

/** Quantos argumentos cada função aceita: [mínimo, máximo] */
export const ARITY: Record<FormulaFn, [number, number]> = {
  if: [3, 3],
  daysUntil: [1, 1],
  today: [0, 0],
  now: [0, 0],
  round: [1, 2],
  min: [1, 20],
  max: [1, 20],
  abs: [1, 1],
  and: [2, 20],
  or: [2, 20],
  not: [1, 1],
  empty: [1, 1],
  length: [1, 1],
  contains: [2, 2],
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

// ---------------------------------------------------------------------------------------------
// Cálculo. Vazio (null) contamina a conta (1 + vazio = vazio), como numa planilha que não inventa
// zero; divisão por zero também dá vazio. Listas só vêm das variáveis (não há literal de lista).
// ---------------------------------------------------------------------------------------------

export type FormulaValue = number | string | boolean | null;
/** Valor de expressão: o da fórmula ou uma lista (variáveis de processo). */
export type ExprValue = FormulaValue | ExprValue[];

export type EvalError =
  | { code: 'unknownField'; name: string }
  | { code: 'cycle'; name: string }
  | { code: 'budget' };

export class FormulaFail extends Error {
  constructor(readonly error: EvalError) {
    super(error.code);
  }
}

/** Operações por avaliação (V16 PR3): passou, a avaliação falha com `budget`. */
export const MAX_OPERACOES = 1000;

export type EvalContext = {
  today: string;
  /** Agora (ISO). Sem ele, `agora()` dá o começo de `today` em UTC. */
  now?: string;
  /** O valor de `{nome}`; undefined = esse campo não existe (lança FormulaFail) */
  field: (name: string) => ExprValue | undefined;
  /** Contador de operações (compartilhado na avaliação inteira) */
  budget?: { left: number };
};

const isDate = (v: ExprValue): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const num = (v: ExprValue): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

const truthy = (v: ExprValue) =>
  v === true ||
  (typeof v === 'number' && v !== 0) ||
  (typeof v === 'string' && v !== '') ||
  (Array.isArray(v) && v.length > 0);

const scalar = (v: ExprValue): FormulaValue => (Array.isArray(v) ? null : v);

/** Comparação de texto sem acento e sem maiúsculas (igual no Node e no Deno, sem depender do ICU). */
const sameText = (a: string, b: string) => fold(a) === fold(b);

function compare(op: string, av: ExprValue, bv: ExprValue): boolean | null {
  const a = scalar(av);
  const b = scalar(bv);
  if (op === '=' || op === '!=') {
    const eq =
      typeof a === 'string' && typeof b === 'string'
        ? sameText(a, b)
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

export function evaluate(node: FormulaNode, ctx: EvalContext): ExprValue {
  const budget = ctx.budget ?? { left: MAX_OPERACOES };
  const c: EvalContext = ctx.budget ? ctx : { ...ctx, budget };
  if (--budget.left < 0) throw new FormulaFail({ code: 'budget' });
  const run = (n: FormulaNode) => evaluate(n, c);
  switch (node.type) {
    case 'number':
    case 'string':
      return node.value;
    case 'field': {
      const v = c.field(node.name);
      if (v === undefined) throw new FormulaFail({ code: 'unknownField', name: node.name });
      return v;
    }
    case 'neg': {
      const v = num(scalar(run(node.arg)));
      return v === null ? null : -v;
    }
    case 'binary': {
      const av = run(node.left);
      const bv = run(node.right);
      if (['=', '!=', '<', '>', '<=', '>='].includes(node.op)) return compare(node.op, av, bv);
      const a = scalar(av);
      const b = scalar(bv);
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
          return c.today;
        case 'now':
          return c.now ?? `${c.today}T00:00:00.000Z`;
        case 'daysUntil': {
          const d = scalar(run(args[0]));
          return d !== null && isDate(d) ? diffDays(c.today, d) : null;
        }
        case 'round': {
          const v = num(scalar(run(args[0])));
          const places = args[1] ? (num(scalar(run(args[1]))) ?? 0) : 0;
          if (v === null) return null;
          const f = 10 ** Math.max(0, Math.min(6, Math.trunc(places)));
          return Math.round(v * f) / f;
        }
        case 'min':
        case 'max': {
          const values = args
            .flatMap((a) => {
              const v = run(a);
              return Array.isArray(v) ? v : [v];
            })
            .map((v) => num(scalar(v)))
            .filter((v): v is number => v !== null);
          if (!values.length) return null;
          return node.fn === 'min' ? Math.min(...values) : Math.max(...values);
        }
        case 'abs': {
          const v = num(scalar(run(args[0])));
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
          return v === null || v === '' || (Array.isArray(v) && v.length === 0);
        }
        case 'length': {
          const v = run(args[0]);
          if (Array.isArray(v)) return v.length;
          if (v === null) return 0;
          return [...String(v)].length;
        }
        case 'contains': {
          const v = run(args[0]);
          const want = scalar(run(args[1]));
          if (want === null) return null;
          if (Array.isArray(v)) return v.some((x) => compare('=', x, want) === true);
          if (v === null) return false;
          return fold(String(v)).includes(fold(String(want)));
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Para os processos (PR3): variáveis com caminho (`{var.cliente.nome}`, `{inicio.titulo}`)
// ---------------------------------------------------------------------------------------------

export type ExprResult = { ok: true; value: ExprValue } | { ok: false; error: FormulaError | EvalError };

/** Lê `a.b.c` num objeto de variáveis; undefined se o caminho não existe. */
export function lerCaminho(vars: Record<string, unknown>, caminho: string): ExprValue | undefined {
  let atual: unknown = vars;
  for (const parte of caminho.split('.').map((p) => p.trim())) {
    if (atual === null || typeof atual !== 'object' || Array.isArray(atual)) return undefined;
    if (!(parte in (atual as Record<string, unknown>))) return undefined;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return paraValor(atual);
}

/** Valor de variável → valor de expressão (objeto vira texto JSON; até 3 níveis de lista). */
function paraValor(v: unknown, nivel = 0): ExprValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return nivel >= 3 ? null : v.map((x) => paraValor(x, nivel + 1));
  return JSON.stringify(v);
}

/** Avalia o texto com as variáveis (o que a validação, a simulação e a Edge Function chamam). */
export function avaliarExpr(
  texto: string,
  vars: Record<string, unknown>,
  quando: { today: string; now?: string },
): ExprResult {
  const p = parseFormula(texto);
  if (!p.ok) return p;
  try {
    return {
      ok: true,
      value: evaluate(p.node, { ...quando, field: (nome) => lerCaminho(vars, nome) }),
    };
  } catch (e) {
    if (e instanceof FormulaFail) return { ok: false, error: e.error };
    throw e;
  }
}
