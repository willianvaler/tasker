// Limites da árvore de subtarefas (V3 §1, D98). Espelho de public.tree_limits(): o teste compara.
// A tarefa raiz é o nível 1. O servidor é a autoridade; aqui é para avisar antes de tentar.

/** Níveis por padrão (decisão do dono do projeto: 5). */
export const DEFAULT_MAX_DEPTH = 5;
/** Menor limite que uma página ou um projeto pode ter. */
export const MIN_MAX_DEPTH = 2;
/** Teto absoluto, por desempenho e usabilidade. */
export const HARD_MAX_DEPTH = 6;
export const MAX_CHILDREN_PER_TASK = 50;

/** Limite que vale numa página: o dela, senão o do projeto, senão o padrão. */
export function effectiveMaxDepth(pageMax?: number | null, projectMax?: number | null) {
  return pageMax ?? projectMax ?? DEFAULT_MAX_DEPTH;
}
