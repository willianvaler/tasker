// Bases (OB8, ESCOPO_V11 §5, D293): a lista do tipo `base` mostra tarefas ou anotações filtradas
// pela linguagem de consulta do OB7 (lib/query/) como tabela ou cartões, com colunas, agrupamento,
// ordem e edição na célula. A configuração mora em `pages.config` (JSON). Funções puras, com testes.

import { fold, type Source } from './query/parse';

export type BaseView = 'table' | 'cards';
export type BaseSort = { column: string; desc: boolean };
export type BaseConfig = {
  /** A consulta (`tarefas onde etiqueta = casa`); o `como tabela`/`limite` dela não valem aqui */
  query: string;
  view: BaseView;
  /** Colunas na ordem; vazio = as padrão da origem. Propriedade de anotação: `props.<nome>` */
  columns: string[];
  /** Agrupar por esta coluna (null = sem grupos) */
  group: string | null;
  /** Ordem escolhida no cabeçalho (vence a do `ordenar por` da consulta) */
  sort: BaseSort | null;
};

export const TASK_COLUMNS = [
  'title',
  'list',
  'due',
  'priority',
  'tags',
  'status',
  'created',
  'completed',
] as const;
export const NOTE_COLUMNS = ['title', 'tags', 'folder', 'created', 'updated'] as const;
export type BaseColumn = (typeof TASK_COLUMNS)[number] | (typeof NOTE_COLUMNS)[number];

const DEFAULT_COLUMNS: Record<Source, string[]> = {
  tasks: ['title', 'list', 'due', 'priority', 'tags'],
  notes: ['title', 'tags', 'updated'],
};

/** Colunas que dá para editar na célula (o resto é do servidor ou derivado) */
export const EDITABLE: Record<Source, readonly string[]> = {
  tasks: ['title', 'due', 'priority', 'tags'],
  notes: ['title'],
};

export const isPropColumn = (column: string) => column.startsWith('props.') && column.length > 6;
export const propName = (column: string) => column.slice(6);

/** A consulta da base sem texto (a base nova nasce com `base.defaultQuery`, no idioma da pessoa) */
export const DEFAULT_QUERY = 'tarefas onde vence <= hoje+7 não concluídas';

/** Lê a configuração guardada (qualquer JSON) com os padrões no que faltar ou vier errado */
export function readBaseConfig(raw: unknown): BaseConfig {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const sort = o.sort && typeof o.sort === 'object' ? (o.sort as Record<string, unknown>) : null;
  return {
    query: typeof o.query === 'string' ? o.query.slice(0, 2000) : '',
    view: o.view === 'cards' ? 'cards' : 'table',
    columns: Array.isArray(o.columns)
      ? [
          ...new Set(o.columns.filter((c): c is string => typeof c === 'string' && c.length > 0)),
        ].slice(0, 20)
      : [],
    group: typeof o.group === 'string' && o.group ? o.group : null,
    sort:
      sort && typeof sort.column === 'string' && sort.column
        ? { column: sort.column, desc: sort.desc === true }
        : null,
  };
}

/** As colunas que a base mostra: as escolhidas que valem para a origem, com o título na frente */
export function baseColumns(config: BaseConfig, source: Source): string[] {
  const known: readonly string[] = source === 'tasks' ? TASK_COLUMNS : NOTE_COLUMNS;
  const valid = (c: string) => known.includes(c) || (source === 'notes' && isPropColumn(c));
  const chosen = config.columns.filter(valid);
  const list = chosen.length ? chosen : DEFAULT_COLUMNS[source];
  return ['title', ...list.filter((c) => c !== 'title')];
}

/** Liga ou desliga uma coluna (o título fica sempre) */
export function toggleColumn(config: BaseConfig, source: Source, column: string): BaseConfig {
  if (column === 'title') return config;
  const current = baseColumns(config, source);
  const columns = current.includes(column)
    ? current.filter((c) => c !== column)
    : [...current, column];
  return { ...config, columns };
}

/** Clicar no cabeçalho: crescente → decrescente → sem ordem (volta a da consulta) */
export function nextSort(sort: BaseSort | null, column: string): BaseSort | null {
  if (!sort || sort.column !== column) return { column, desc: false };
  if (!sort.desc) return { column, desc: true };
  return null;
}

/** As propriedades usadas nas anotações (para oferecer como coluna), na ordem do nome */
export function notePropNames(notes: readonly { props: Record<string, unknown> | null }[]) {
  const names = new Map<string, string>();
  for (const n of notes)
    for (const key of Object.keys(n.props ?? {})) {
      if (key === 'aliases' || key === 'apelidos') continue;
      if (!names.has(fold(key))) names.set(fold(key), key);
    }
  return [...names.values()].sort((a, b) => fold(a).localeCompare(fold(b)));
}

/** O valor bruto de uma propriedade, sem diferença de maiúsculas e acentos no nome */
export function propValue(props: Record<string, unknown> | null, name: string): unknown {
  if (!props) return undefined;
  if (name in props) return props[name];
  const key = Object.keys(props).find((k) => fold(k) === fold(name));
  return key ? props[key] : undefined;
}

/** Texto de um valor qualquer para a célula e o grupo */
export function showValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(showValue).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? '☑' : '☐';
  return String(value);
}

/** Comparável para ordenar: número, texto sem acento; vazio vai para o fim */
function sortable(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.length ? fold(value.map(String).join(', ')) : null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const n =
    typeof value === 'string' && /^-?\d+([.,]\d+)?$/.test(value.trim())
      ? Number(value.replace(',', '.'))
      : NaN;
  return Number.isFinite(n) ? n : fold(String(value));
}

/** Ordena pelo valor da coluna; sem valor fica no fim nos dois sentidos; empate mantém a ordem */
export function sortRows<T>(rows: readonly T[], valueOf: (row: T) => unknown, desc: boolean): T[] {
  return rows
    .map((row, i) => ({ row, i, v: sortable(valueOf(row)) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      // Números antes do texto (no crescente)
      const diff =
        typeof a.v !== typeof b.v
          ? typeof a.v === 'number'
            ? -1
            : 1
          : a.v < b.v
            ? -1
            : a.v > b.v
              ? 1
              : 0;
      return (desc ? -diff : diff) || a.i - b.i;
    })
    .map((x) => x.row);
}

export type RowGroup<T> = { key: string; rows: T[] };

/**
 * Agrupa pelo texto de `keyOf` (vazio = sem valor, o último grupo). Com lista (etiquetas), a linha
 * entra em cada grupo, como nas Bases do Obsidian. Os grupos seguem a ordem de `order` (número ou
 * texto); sem `order`, a ordem do texto.
 */
export function groupRows<T>(
  rows: readonly T[],
  keyOf: (row: T) => string | string[],
  order?: (key: string) => string | number,
): RowGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const raw = keyOf(row);
    const keys = Array.isArray(raw) ? (raw.length ? raw : ['']) : [raw];
    for (const key of new Set(keys)) {
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }
  }
  const rank = order ?? ((k: string) => fold(k));
  return [...groups.entries()]
    .map(([key, list]) => ({ key, rows: list }))
    .sort((a, b) => {
      if (!a.key || !b.key) return a.key === b.key ? 0 : a.key ? -1 : 1;
      const x = rank(a.key);
      const y = rank(b.key);
      return x < y ? -1 : x > y ? 1 : 0;
    });
}

export type CellParse = { ok: true; value: unknown } | { ok: false };

/**
 * Texto digitado na célula → o valor a gravar. Prioridade 0 a 3 (ou !, !!, !!!); data AAAA-MM-DD
 * (vazio tira); etiquetas separadas por espaço ou vírgula (o # é opcional). Propriedade de anotação
 * segue o tipo que já tem: número, caixinha (sim/não), lista (vírgulas) ou texto.
 */
export function parseCell(column: string, text: string, current?: unknown): CellParse {
  const value = text.trim();
  if (column === 'title') return value ? { ok: true, value: value.slice(0, 500) } : { ok: false };
  if (column === 'priority') {
    if (!value) return { ok: true, value: 0 };
    if (/^!{1,3}$/.test(value)) return { ok: true, value: value.length };
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 3 ? { ok: true, value: n } : { ok: false };
  }
  if (column === 'due') {
    if (!value) return { ok: true, value: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false };
    const d = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value
      ? { ok: false }
      : { ok: true, value };
  }
  if (column === 'tags') {
    const tags = value
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, ''))
      .filter(Boolean);
    return { ok: true, value: [...new Set(tags)].slice(0, 30) };
  }
  if (isPropColumn(column)) {
    if (!value) return { ok: true, value: null };
    if (typeof current === 'number') {
      const n = Number(value.replace(',', '.'));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    if (typeof current === 'boolean') {
      const yes = ['sim', 'yes', 'si', 'sí', 'true', '1', 'x', '☑'];
      const no = ['não', 'nao', 'no', 'false', '0', '☐'];
      if (yes.includes(fold(value))) return { ok: true, value: true };
      if (no.map(fold).includes(fold(value))) return { ok: true, value: false };
      return { ok: false };
    }
    if (Array.isArray(current))
      return {
        ok: true,
        value: value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      };
    return { ok: true, value };
  }
  return { ok: false };
}

/** Texto inicial do campo ao editar a célula */
export function cellInput(column: string, value: unknown): string {
  if (column === 'tags' && Array.isArray(value)) return value.join(' ');
  if (column === 'priority') return value ? String(value) : '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'boolean') return value ? '1' : '0';
  return value === null || value === undefined ? '' : String(value);
}
