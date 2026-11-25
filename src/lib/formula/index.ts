import type { FieldKind } from '../fields';
import type { IsoDate } from '../parser/dates';
import { fold } from '../query/parse';
import { evaluate, FormulaFail, type EvalError, type FormulaValue } from './eval';
import { formulaFields, parseFormula, type FormulaError, type FormulaParse } from './parse';

// Campo calculado (VS2, D318): o valor de um campo `formula` numa tarefa. `{nome}` é um campo da
// lista (pelo nome, sem acento nem maiúsculas) ou um dos da tarefa, nos três idiomas.

export { parseFormula } from './parse';
export type { FormulaValue } from './eval';

export type FormulaFieldDef = {
  id: string;
  name: string;
  kind: FieldKind;
  formula?: string | null;
};

export type FormulaTask = {
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
  start_date: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  custom: unknown;
};

const BUILTINS: [string[], (t: FormulaTask) => FormulaValue][] = [
  [['titulo', 'title'], (t) => t.title],
  [['vencimento', 'prazo', 'due', 'vencimiento', 'plazo'], (t) => t.due_date],
  [['inicio', 'start'], (t) => t.start_date],
  [['prioridade', 'priority', 'prioridad'], (t) => t.priority],
  [['estimativa', 'estimate', 'estimacion'], (t) => t.estimate_minutes],
  [['tempo', 'time', 'tiempo'], (t) => t.actual_minutes],
  [['concluida', 'done', 'completada'], (t) => t.status === 'done'],
];
const BUILTIN = new Map<string, (t: FormulaTask) => FormulaValue>();
for (const [list, get] of BUILTINS) for (const n of list) BUILTIN.set(fold(n), get);

export type FormulaIssue = FormulaError | EvalError;
export type FormulaResult = { ok: true; value: FormulaValue } | { ok: false; error: FormulaIssue };

const parsed = new Map<string, FormulaParse>();
function parseCached(src: string) {
  let p = parsed.get(src);
  if (!p) {
    p = parseFormula(src);
    if (parsed.size > 500) parsed.clear();
    parsed.set(src, p);
  }
  return p;
}

const raw = (task: FormulaTask, id: string): FormulaValue => {
  const custom = task.custom && typeof task.custom === 'object' ? task.custom : {};
  const v = (custom as Record<string, unknown>)[id];
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : null;
};

/** O valor do campo calculado `field` nesta tarefa (ou o erro da fórmula). */
export function computeFormula(
  field: FormulaFieldDef,
  task: FormulaTask,
  fields: readonly FormulaFieldDef[],
  today: IsoDate,
  stack: string[] = [],
): FormulaResult {
  const p = parseCached(field.formula ?? '');
  if (!p.ok) return { ok: false, error: p.error };
  const byName = new Map(fields.map((f) => [fold(f.name.trim()), f]));
  try {
    const value = evaluate(p.node, {
      today,
      field: (name) => {
        const other = byName.get(fold(name.trim()));
        if (other) {
          if (other.kind !== 'formula') return raw(task, other.id);
          if (other.id === field.id || stack.includes(other.id))
            throw new FormulaFail({ code: 'cycle', name: other.name });
          const r = computeFormula(other, task, fields, today, [...stack, field.id]);
          if (!r.ok) throw new FormulaFail(r.error as EvalError);
          return r.value;
        }
        const builtin = BUILTIN.get(fold(name.trim()));
        return builtin ? builtin(task) : undefined;
      },
    });
    // Campo da lista nunca é lista: lista só existe nas variáveis de processo
    const v = Array.isArray(value) ? null : value;
    return { ok: true, value: typeof v === 'number' && !Number.isFinite(v) ? null : v };
  } catch (e) {
    if (e instanceof FormulaFail) return { ok: false, error: e.error };
    throw e;
  }
}

/**
 * Confere a fórmula ao salvar o campo: escrita, nomes que existem (mesmo no ramo do `se` que não
 * roda) e sem ciclo entre campos calculados. null = está certa.
 */
export function checkFormula(
  formula: string,
  self: { id: string; name: string },
  fields: readonly FormulaFieldDef[],
): FormulaIssue | null {
  const p = parseFormula(formula);
  if (!p.ok) return p.error;
  const others = new Map(
    fields.filter((f) => f.id !== self.id).map((f) => [fold(f.name.trim()), f]),
  );
  const visit = (names: string[], path: string[]): FormulaIssue | null => {
    for (const name of names) {
      const key = fold(name.trim());
      if (key === fold(self.name.trim())) return { code: 'cycle', name: self.name };
      const other = others.get(key);
      if (!other) {
        if (BUILTIN.has(key)) continue;
        return { code: 'unknownField', name };
      }
      if (other.kind !== 'formula') continue;
      if (path.includes(other.id)) return { code: 'cycle', name: other.name };
      const q = parseFormula(other.formula ?? '');
      if (!q.ok) continue;
      const issue = visit(formulaFields(q.node), [...path, other.id]);
      if (issue) return issue;
    }
    return null;
  };
  return visit(formulaFields(p.node), [self.id]);
}
