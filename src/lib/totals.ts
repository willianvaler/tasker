// Totais no rodapé da tabela (VS2, ESCOPO_V12 §8, D318): nas visões Tabela (VS1) e nas Bases (OB8).
// Coluna de número (ou dinheiro, ou fórmula que dá número): soma, média, mínimo, máximo ou contagem;
// coluna de valores (seleção, estado, etiqueta): quantas de cada. Funções puras, com teste.

export const NUMBER_TOTALS = ['sum', 'avg', 'min', 'max', 'count', 'none'] as const;
export const VALUE_TOTALS = ['values', 'count', 'none'] as const;
export type TotalKind = (typeof NUMBER_TOTALS)[number] | (typeof VALUE_TOTALS)[number];
export type Totals = Record<string, TotalKind>;

const ALL: readonly string[] = [...NUMBER_TOTALS, ...VALUE_TOTALS];

/** O que veio do JSON → só as colunas com um total conhecido. */
export function readTotals(raw: unknown): Totals {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Totals = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (typeof v === 'string' && ALL.includes(v) && k.length <= 80) out[k] = v as TotalKind;
  return out;
}

const empty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** A coluna é de número quando todo valor preenchido é número (e há pelo menos um). */
export function isNumberColumn(values: readonly unknown[]) {
  const filled = values.filter((v) => !empty(v));
  return filled.length > 0 && filled.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** O total padrão: soma no número; nos outros, nada (título, datas) até escolher. */
export function defaultTotal(values: readonly unknown[]): TotalKind {
  return isNumberColumn(values) ? 'sum' : 'none';
}

/** Próximo total ao tocar no rodapé (a ordem da coluna: número ou valores). */
export function nextTotal(current: TotalKind, numeric: boolean): TotalKind {
  const list: readonly TotalKind[] = numeric ? NUMBER_TOTALS : VALUE_TOTALS;
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

export type TotalResult =
  | { kind: 'none' }
  | { kind: 'number'; total: Exclude<TotalKind, 'values' | 'none'>; value: number | null }
  | { kind: 'values'; counts: { value: string; count: number }[] };

/**
 * O total da coluna. Etiquetas (lista) contam cada uma; `count` é quantas linhas têm valor.
 * Total de número pedido numa coluna que não é de número vira contagem.
 */
export function computeTotal(values: readonly unknown[], total: TotalKind): TotalResult {
  if (total === 'none') return { kind: 'none' };
  if (total === 'count')
    return { kind: 'number', total: 'count', value: values.filter((v) => !empty(v)).length };
  if (total === 'values') {
    const counts = new Map<string, number>();
    for (const v of values) {
      if (empty(v)) continue;
      for (const item of Array.isArray(v) ? v : [v]) {
        const key = String(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return {
      kind: 'values',
      counts: [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    };
  }
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  // Coluna sem nada preenchido: o total fica vazio (não é "0", nem vira contagem)
  if (values.every(empty)) return { kind: 'number', total, value: null };
  if (!isNumberColumn(values))
    return { kind: 'number', total: 'count', value: values.filter((v) => !empty(v)).length };
  const sum = nums.reduce((a, b) => a + b, 0);
  const value =
    total === 'sum'
      ? sum
      : total === 'avg'
        ? sum / nums.length
        : total === 'min'
          ? Math.min(...nums)
          : Math.max(...nums);
  // Evita 0.30000000000000004 na soma de centavos
  return { kind: 'number', total, value: Math.round(value * 1e6) / 1e6 };
}

/**
 * Total das subtarefas na mãe (rollup): cada filha vale o próprio valor ou, se não tiver, o total
 * das filhas dela. null = nenhuma filha tem valor.
 */
export function rollup(
  id: string,
  kids: ReadonlyMap<string, readonly { id: string }[]>,
  valueOf: (id: string) => number | null,
  seen: Set<string> = new Set(),
): number | null {
  if (seen.has(id)) return null;
  seen.add(id);
  let total: number | null = null;
  for (const child of kids.get(id) ?? []) {
    const own = valueOf(child.id);
    const v = own ?? rollup(child.id, kids, valueOf, seen);
    if (v !== null) total = (total ?? 0) + v;
  }
  return total;
}

/** Soma de todas as descendentes (o tempo: cada registro é de uma tarefa só, então tudo soma). */
export function sumDescendants(
  id: string,
  kids: ReadonlyMap<string, readonly { id: string }[]>,
  valueOf: (id: string) => number,
  seen: Set<string> = new Set(),
): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  let total = 0;
  for (const child of kids.get(id) ?? [])
    total += valueOf(child.id) + sumDescendants(child.id, kids, valueOf, seen);
  return total;
}
