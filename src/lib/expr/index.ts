// Expressões dos processos (ESCOPO_V16 PR3, FN0, D344): a mesma linguagem do campo calculado
// (src/lib/formula), num módulo sem imports que a Edge Function `process-run` também usa. Mesmo
// código, mesmos resultados (teste de paridade em src/lib/__tests__/expr-paridade.test.ts).
export {
  ARITY,
  avaliarExpr,
  evaluate,
  fold,
  FormulaFail,
  formulaFields,
  lerCaminho,
  MAX_FORMULA,
  MAX_OPERACOES,
  parseFormula,
  type EvalError,
  type ExprResult,
  type ExprValue,
  type FormulaError,
  type FormulaNode,
} from '../../../supabase/functions/_shared/expr';
