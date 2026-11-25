// Processos (ESCOPO_V16 Parte B, D349): o motor e a validação do grafo são do módulo compartilhado
// com o executor (supabase/functions/_shared/processo.ts); aqui eles recebem a linguagem de
// expressões (src/lib/expr) e os textos.
import { avaliarExpr, formulaFields, parseFormula } from '@/lib/expr';
import { tr } from '@/lib/i18n-ref';

import { CATALOGO } from '../../../supabase/functions/_shared/automation-engine';
import {
  avancar,
  validarGrafo,
  type ErroGrafo,
  type ExprApi,
  type Grafo,
} from '../../../supabase/functions/_shared/processo';

export * from '../../../supabase/functions/_shared/processo';

export const exprApi: ExprApi = {
  erro: (texto) => {
    const p = parseFormula(texto);
    return p.ok ? null : p.error.code;
  },
  campos: (texto) => {
    const p = parseFormula(texto);
    return p.ok ? formulaFields(p.node) : [];
  },
  avaliar: (texto, vars, quando) => avaliarExpr(texto, vars, quando),
};

/** Ações do V14 que uma tarefa de serviço pode usar (as de controle viram nós do processo). */
export const ACOES_DE_SERVICO = Object.keys(CATALOGO.passos).filter(
  (p) => !['se', 'parar', 'esperar', 'executar_regra', 'definir_variavel', 'atribuir'].includes(p),
);

export const validar = (g: Grafo) => validarGrafo(g, exprApi, ACOES_DE_SERVICO);

/** O erro em texto para a pessoa, apontando o nó. */
export function textoDoErro(e: ErroGrafo, nomes: Map<string, string>): string {
  const no = e.no ? (nomes.get(e.no) ?? e.no) : '';
  return tr(`processos.erro.${e.codigo}`, { no, detalhe: e.detalhe ?? '' });
}

export { avancar };
