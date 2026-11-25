// Calcula a árvore da fórmula (VS2, D318), pelo módulo compartilhado (FN0, D344). O valor é sempre
// do app, nunca guardado: o banco tem os valores dos outros campos e a fórmula só lê.
export {
  evaluate,
  FormulaFail,
  MAX_OPERACOES,
  type EvalContext,
  type EvalError,
  type ExprValue,
  type FormulaValue,
} from '../../../supabase/functions/_shared/expr';
