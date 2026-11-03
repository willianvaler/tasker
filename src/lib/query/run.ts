// Executor da linguagem de consulta (OB7, D292): decide o que ler do aparelho (o filtro seletivo)
// e filtra, ordena e corta as linhas lidas. Funções puras, com testes.

import { tagMatches } from '../note-props';
import { addDays } from '../parser/dates';
import { fold, type Condition, type Field, type Query, type Value } from './parse';

export type QueryContext = {
  /** Hoje ('YYYY-MM-DD') no fuso do perfil */
  today: string;
  /** O dia ('YYYY-MM-DD') de um instante, no fuso do perfil */
  dayOf: (iso: string) => string;
};

export type QueryTask = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
  labels: string[] | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  page_id: string | null;
  folder_id: string | null;
  parent_task_id: string | null;
};

export type QueryNote = {
  id: string;
  title: string;
  body: string;
  tags: string[] | null;
  props: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
};

type Named = { id: string; name: string };

/** O que ler: sempre por um filtro seletivo (lista, pasta, etiqueta ou intervalo de datas) */
export type FetchPlan =
  | { by: 'pages'; ids: string[] }
  | { by: 'folders'; ids: string[] }
  | { by: 'tag'; tag: string }
  | { by: 'due' | 'created' | 'completed'; from: string | null; to: string | null }
  | { by: 'none' };

/** Nomes de lista ou pasta que não existem (para avisar em vez de responder vazio) */
export function unknownNames(query: Query, pages: Named[], folders: Named[]) {
  const has = (list: Named[], name: string) => list.some((x) => fold(x.name) === fold(name));
  return [
    ...query.lists.filter((n) => !has(pages, n)),
    ...query.folders.filter((n) => !has(folders, n)),
  ];
}

const dayValue = (value: Value, ctx: QueryContext): string | null =>
  value.kind === 'day'
    ? addDays(ctx.today, value.offset)
    : value.kind === 'date'
      ? value.value
      : null;

/** Lista e pasta pelo nome (sem maiúsculas e acentos); pasta inclui as subpastas */
export function fetchPlan(
  query: Query,
  ctx: QueryContext,
  pages: Named[],
  folders: (Named & { parent_id?: string | null })[],
): FetchPlan {
  const byName = (list: Named[], names: string[]) =>
    list.filter((x) => names.some((n) => fold(n) === fold(x.name))).map((x) => x.id);
  if (query.lists.length) return { by: 'pages', ids: byName(pages, query.lists) };
  if (query.folders.length) {
    const roots = byName(folders, query.folders);
    const children = folders.filter((f) => f.parent_id && roots.includes(f.parent_id));
    return { by: 'folders', ids: [...roots, ...children.map((c) => c.id)] };
  }
  const tag = query.conditions.find((c) => c.field.kind === 'tag' && c.op === '=');
  if (tag && tag.value.kind !== 'number') return { by: 'tag', tag: valueText(tag.value) };
  for (const kind of ['due', 'created', 'completed'] as const) {
    let from: string | null = null;
    let to: string | null = null;
    for (const c of query.conditions) {
      if (c.field.kind !== kind) continue;
      const day = dayValue(c.value, ctx);
      if (!day) continue;
      if (c.op === '=' || c.op === '>=' || c.op === '>')
        from = c.op === '>' ? addDays(day, 1) : day;
      if (c.op === '=' || c.op === '<=' || c.op === '<') to = c.op === '<' ? addDays(day, -1) : day;
    }
    if (from || to) return { by: kind, from, to };
  }
  return { by: 'none' };
}

function valueText(value: Value) {
  return value.kind === 'text'
    ? value.value
    : value.kind === 'number'
      ? String(value.value)
      : value.kind === 'bool'
        ? String(value.value)
        : value.kind === 'date'
          ? value.value
          : '';
}

const cleanTag = (t: string) => fold(t.replace(/^#/, ''));

function compare(a: string | number, b: string | number, op: Condition['op']) {
  switch (op) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case 'contains':
      return String(a).includes(String(b));
  }
}

/** Valor escalar contra a condição (texto sem acento; data; número) */
function matchScalar(raw: unknown, c: Condition, ctx: QueryContext): boolean {
  if (raw === null || raw === undefined || raw === '') return c.op === '!=';
  if (c.value.kind === 'bool') return compare(raw === true ? 1 : 0, c.value.value ? 1 : 0, c.op);
  if (c.value.kind === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) && compare(n, c.value.value, c.op);
  }
  const day = dayValue(c.value, ctx);
  if (day) return compare(String(raw).slice(0, 10), day, c.op);
  return compare(fold(String(raw)), fold(valueText(c.value)), c.op);
}

function matchList(items: string[], c: Condition, nested: boolean): boolean {
  const want = cleanTag(valueText(c.value));
  const has = items.some((t) => {
    const tag = cleanTag(t);
    return nested ? tagMatches(tag, want) : tag === want;
  });
  if (c.op === '=') return has;
  if (c.op === '!=') return !has;
  if (c.op === 'contains') return items.some((t) => cleanTag(t).includes(want));
  return false;
}

function propOf(props: Record<string, unknown> | null, name: string): unknown {
  if (!props) return undefined;
  if (name in props) return props[name];
  const key = Object.keys(props).find((k) => fold(k) === fold(name));
  return key ? props[key] : undefined;
}

function taskField(task: QueryTask, field: Field, ctx: QueryContext): unknown {
  switch (field.kind) {
    case 'due':
      return task.due_date;
    case 'priority':
      return task.priority;
    case 'title':
      return task.title;
    case 'status':
      return task.status;
    case 'created':
      return ctx.dayOf(task.created_at);
    case 'updated':
      return ctx.dayOf(task.updated_at);
    case 'completed':
      return task.completed_at ? ctx.dayOf(task.completed_at) : null;
    case 'tag':
      return (task.labels ?? []).join(', ');
    case 'prop':
      return undefined;
  }
}

function noteField(note: QueryNote, field: Field, ctx: QueryContext): unknown {
  switch (field.kind) {
    case 'title':
      return note.title;
    case 'created':
      return ctx.dayOf(note.created_at);
    case 'updated':
      return ctx.dayOf(note.updated_at);
    case 'tag':
      return (note.tags ?? []).join(', ');
    case 'prop':
      return propOf(note.props, field.name);
    case 'due': {
      // "vence"/"data" nas anotações: a propriedade de data com esse nome, se houver
      const value = propOf(note.props, 'data') ?? propOf(note.props, 'date');
      return typeof value === 'string' ? value : null;
    }
    default:
      return undefined;
  }
}

function matchTask(task: QueryTask, c: Condition, ctx: QueryContext) {
  if (c.field.kind === 'tag') return matchList(task.labels ?? [], c, false);
  return matchScalar(taskField(task, c.field, ctx), c, ctx);
}

function matchNote(note: QueryNote, c: Condition, ctx: QueryContext) {
  if (c.field.kind === 'tag') return matchList(note.tags ?? [], c, true);
  if (c.field.kind === 'prop') {
    const value = propOf(note.props, c.field.name);
    if (Array.isArray(value))
      return matchList(
        value.filter((v): v is string => typeof v === 'string'),
        c,
        false,
      );
    return matchScalar(value, c, ctx);
  }
  return matchScalar(noteField(note, c.field, ctx), c, ctx);
}

function sortValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return value.join(', ');
  return fold(String(value));
}

function sortBy<T>(rows: T[], get: (row: T) => unknown, desc: boolean) {
  return rows
    .map((row, i) => ({ row, i, v: sortValue(get(row)) }))
    .sort((a, b) => {
      // Sem valor vai para o fim, nos dois sentidos
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const diff = a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
      return (desc ? -diff : diff) || a.i - b.i;
    })
    .map((x) => x.row);
}

/** Até quantas linhas a consulta mostra sem `limite` */
export const DEFAULT_LIMIT = 100;

export type QueryResult<T> = { rows: T[]; total: number };

export function runTasks(
  rows: QueryTask[],
  query: Query,
  ctx: QueryContext,
  scope: { pageIds?: string[]; folderIds?: string[] } = {},
): QueryResult<QueryTask> {
  let out = rows.filter(
    (t) =>
      (!scope.pageIds || (t.page_id !== null && scope.pageIds.includes(t.page_id))) &&
      (!scope.folderIds || (t.folder_id !== null && scope.folderIds.includes(t.folder_id))) &&
      (query.done === null || (t.status === 'done') === query.done) &&
      query.conditions.every((c) => matchTask(t, c, ctx)),
  );
  out = query.sort
    ? sortBy(out, (t) => taskField(t, query.sort!.field, ctx), query.sort.desc)
    : sortBy(
        sortBy(out, (t) => t.priority, true),
        (t) => t.due_date,
        false,
      );
  return { rows: out.slice(0, query.limit ?? DEFAULT_LIMIT), total: out.length };
}

export function runNotes(
  rows: QueryNote[],
  query: Query,
  ctx: QueryContext,
  scope: { folderIds?: string[] } = {},
): QueryResult<QueryNote> {
  let out = rows.filter(
    (n) =>
      (!scope.folderIds || (n.folder_id !== null && scope.folderIds.includes(n.folder_id))) &&
      query.conditions.every((c) => matchNote(n, c, ctx)),
  );
  out = query.sort
    ? sortBy(out, (n) => noteField(n, query.sort!.field, ctx), query.sort.desc)
    : sortBy(out, (n) => n.updated_at, true);
  return { rows: out.slice(0, query.limit ?? DEFAULT_LIMIT), total: out.length };
}

/** As propriedades citadas na consulta (as colunas extras da tabela de anotações) */
export function propColumns(query: Query): string[] {
  const names = [...query.conditions.map((c) => c.field), ...(query.sort ? [query.sort.field] : [])]
    .filter((f): f is { kind: 'prop'; name: string } => f.kind === 'prop')
    .map((f) => f.name);
  return [...new Set(names)];
}

export { propOf };
