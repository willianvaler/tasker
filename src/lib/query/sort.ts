// Ordem pelo cabeçalho da tabela da consulta (R2a, D369): só na tela, sem mudar o texto da consulta.

export type SortValue = string | number | null;

/** O valor que a coluna compara: vazio vira null; caixinha vira 0/1; lista vira texto. */
export const sortKey = (value: unknown): SortValue =>
  value === null || value === undefined || value === ''
    ? null
    : typeof value === 'number'
      ? value
      : typeof value === 'boolean'
        ? Number(value)
        : Array.isArray(value)
          ? value.join(', ')
          : String(value);

/** Vazio sempre no fim (nas duas direções); número com número; o resto pela ordem do idioma. */
export function compareSortValues(a: SortValue, b: SortValue, desc: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const r =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return desc ? -r : r;
}
