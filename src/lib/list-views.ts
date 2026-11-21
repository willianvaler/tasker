import { addDays, type IsoDate } from './parser/dates';
import { readTotals, type Totals } from './totals';

// Visões salvas da mesma lista (VS1, ESCOPO_V12 §7, D317). A mesma lista (as mesmas tarefas) vista
// como Lista, Quadro, Tabela, Calendário ou Gantt, cada visão com filtro, ordem, agrupamento e
// colunas. As do projeto moram em `pages.config.views` (gravar pede `page.manage`); as pessoais, em
// `profiles.ui_prefs.list_views[<lista>]`. Funções puras, com teste; a tela só desenha.

export const VIEW_KINDS = ['list', 'board', 'table', 'calendar', 'gantt'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];
export type ViewScope = 'project' | 'personal';
/** Agrupar por: nada, estado, prioridade, responsável, etiqueta ou um campo (`field:<id>`) */
export type ViewGroup = 'none' | 'status' | 'priority' | 'assignee' | 'label' | `field:${string}`;
export const VIEW_SORTS = ['position', 'due', 'priority', 'title', 'created'] as const;
export type ViewSort = (typeof VIEW_SORTS)[number];
export type ViewFilter = {
  status: 'open' | 'done' | 'all';
  due: 'any' | 'overdue' | 'week' | 'undated';
  /** Só com esta etiqueta */
  label: string | null;
  /** Só as atribuídas a mim */
  mine: boolean;
};
/** Colunas da tabela: as fixas e `field:<id>` (campo personalizado) */
export const VIEW_COLUMNS = [
  'title',
  'due',
  'start',
  'priority',
  'tags',
  'status',
  'assignees',
  'estimate',
  'time',
] as const;

export type ListView = {
  id: string;
  name: string;
  kind: ViewKind;
  group: ViewGroup;
  sort: ViewSort;
  desc: boolean;
  filter: ViewFilter;
  columns: string[];
  /** Total do rodapé por coluna (VS2) */
  totals: Totals;
};
export type ScopedView = ListView & { scope: ViewScope };

/** Visões por lista (o bastante para abas; o resto fica de fora) */
export const MAX_VIEWS = 12;

export const DEFAULT_FILTER: ViewFilter = { status: 'all', due: 'any', label: null, mine: false };
const DEFAULT_COLUMNS = ['title', 'due', 'priority', 'tags', 'status'];

/** Visão nova com os padrões do tipo (o quadro nasce por estado; a tabela, com as colunas comuns). */
export function newView(id: string, name: string, kind: ViewKind): ListView {
  return {
    id,
    name,
    kind,
    group: kind === 'board' ? 'status' : 'none',
    sort: 'position',
    desc: false,
    filter: { ...DEFAULT_FILTER },
    columns: kind === 'table' ? [...DEFAULT_COLUMNS] : [],
    totals: {},
  };
}

const isGroup = (v: unknown): v is ViewGroup =>
  v === 'none' ||
  v === 'status' ||
  v === 'priority' ||
  v === 'assignee' ||
  v === 'label' ||
  (typeof v === 'string' && /^field:[\w-]{1,64}$/.test(v));

const isColumn = (v: unknown): v is string =>
  typeof v === 'string' &&
  ((VIEW_COLUMNS as readonly string[]).includes(v) || /^field:[\w-]{1,64}$/.test(v));

/** Uma visão vinda do JSON (do banco ou das preferências); o que vier errado fica no padrão. */
function readView(raw: unknown): ListView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || o.id.length > 64) return null;
  const kind = (VIEW_KINDS as readonly unknown[]).includes(o.kind) ? (o.kind as ViewKind) : null;
  if (!kind) return null;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
  const f = o.filter && typeof o.filter === 'object' ? (o.filter as Record<string, unknown>) : {};
  const group = isGroup(o.group) ? o.group : 'none';
  return {
    id: o.id,
    name: name || '…',
    kind,
    // O quadro sempre tem colunas: sem grupo, vale o estado
    group: kind === 'board' && group === 'none' ? 'status' : group,
    sort: (VIEW_SORTS as readonly unknown[]).includes(o.sort) ? (o.sort as ViewSort) : 'position',
    desc: o.desc === true,
    filter: {
      status: f.status === 'open' || f.status === 'done' ? f.status : 'all',
      due: f.due === 'overdue' || f.due === 'week' || f.due === 'undated' ? f.due : 'any',
      label: typeof f.label === 'string' && f.label.trim() ? f.label.trim().slice(0, 60) : null,
      mine: f.mine === true,
    },
    columns: Array.isArray(o.columns)
      ? o.columns.filter(isColumn).filter((c, i, all) => all.indexOf(c) === i)
      : [],
    totals: readTotals(o.totals),
  };
}

/** Lista de visões (JSON) → as válidas, sem id repetido, no máximo MAX_VIEWS. */
export function readViews(raw: unknown): ListView[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const views: ListView[] = [];
  for (const item of raw) {
    const view = readView(item);
    if (!view || seen.has(view.id)) continue;
    seen.add(view.id);
    views.push(view);
    if (views.length === MAX_VIEWS) break;
  }
  return views;
}

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** As visões do projeto, em `pages.config.views`. */
export const pageViews = (config: unknown) => readViews(asObject(config).views);

/** Junta as visões ao resto da configuração da lista (vazio tira a chave). */
export function writePageViews(config: unknown, views: ListView[]) {
  const { views: _old, ...rest } = asObject(config);
  return views.length ? { ...rest, views } : rest;
}

/** As pessoais desta lista, em `ui_prefs.list_views`. */
export const personalViews = (listViews: unknown, pageId: string) =>
  readViews(asObject(listViews)[pageId]);

/** O `ui_prefs.list_views` novo com as visões pessoais desta lista (vazio tira a lista). */
export function writePersonalViews(listViews: unknown, pageId: string, views: ListView[]) {
  const { [pageId]: _old, ...rest } = asObject(listViews);
  return views.length ? { ...rest, [pageId]: views } : rest;
}

/** As abas: as do projeto primeiro, depois as minhas (id repetido fica com a do projeto). */
export function allViews(project: ListView[], personal: ListView[]): ScopedView[] {
  const ids = new Set(project.map((v) => v.id));
  return [
    ...project.map((v) => ({ ...v, scope: 'project' as const })),
    ...personal.filter((v) => !ids.has(v.id)).map((v) => ({ ...v, scope: 'personal' as const })),
  ];
}

/** Troca (ou acrescenta, se é nova) uma visão na lista, mantendo a ordem. */
export function upsertView(views: ListView[], view: ListView): ListView[] {
  const at = views.findIndex((v) => v.id === view.id);
  if (at < 0) return [...views, view].slice(0, MAX_VIEWS);
  return views.map((v, i) => (i === at ? view : v));
}

export const removeView = (views: ListView[], id: string) => views.filter((v) => v.id !== id);

// ============================================================
// Filtrar, ordenar e agrupar
// ============================================================

export type ViewTask = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
  labels: string[] | null;
  position: number;
  created_at: string;
  custom: unknown;
  parent_task_id: string | null;
};

export type ViewContext = {
  today: IsoDate;
  me: string | null;
  /** Ids de quem é responsável pela tarefa */
  assigneesOf: (taskId: string) => string[];
};

/** O valor guardado de um campo personalizado (`tasks.custom[<id>]`) */
export function fieldValue(task: Pick<ViewTask, 'custom'>, fieldId: string): unknown {
  const v = asObject(task.custom)[fieldId];
  return v === undefined ? null : v;
}

export function matchesFilter(task: ViewTask, filter: ViewFilter, ctx: ViewContext) {
  const done = task.status === 'done';
  if (filter.status === 'open' && done) return false;
  if (filter.status === 'done' && !done) return false;
  if (filter.due === 'overdue' && !(task.due_date && task.due_date < ctx.today && !done))
    return false;
  if (
    filter.due === 'week' &&
    !(task.due_date && task.due_date >= ctx.today && task.due_date <= addDays(ctx.today, 7))
  )
    return false;
  if (filter.due === 'undated' && task.due_date) return false;
  if (filter.label && !(task.labels ?? []).includes(filter.label)) return false;
  if (filter.mine && !(ctx.me && ctx.assigneesOf(task.id).includes(ctx.me))) return false;
  return true;
}

const byPosition = (a: ViewTask, b: ViewTask) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Ordem da visão. Sem data vai sempre para o fim; o empate fica na ordem da lista. */
export function sortTasks<T extends ViewTask>(tasks: readonly T[], sort: ViewSort, desc: boolean) {
  const sign = desc ? -1 : 1;
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case 'due':
        if (!a.due_date || !b.due_date) return a.due_date ? -1 : b.due_date ? 1 : 0;
        return sign * a.due_date.localeCompare(b.due_date);
      // Prioridade: a mais alta primeiro (inverter põe as sem prioridade no alto)
      case 'priority':
        return sign * (b.priority - a.priority);
      case 'title':
        return sign * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'created':
        return sign * a.created_at.localeCompare(b.created_at);
      default:
        return sign * byPosition(a, b);
    }
  };
  return [...tasks].sort((a, b) => compare(a, b) || byPosition(a, b));
}

/**
 * As tarefas da visão. Lista, quadro e tabela mostram as de cima (as subtarefas ficam dentro da mãe,
 * como na lista); calendário e Gantt, todas.
 */
export function applyView<T extends ViewTask>(
  tasks: readonly T[],
  view: ListView,
  ctx: ViewContext,
) {
  const all = view.kind === 'calendar' || view.kind === 'gantt';
  return sortTasks(
    tasks.filter((t) => (all || !t.parent_task_id) && matchesFilter(t, view.filter, ctx)),
    view.sort,
    view.desc,
  );
}

export const groupField = (group: ViewGroup) =>
  group.startsWith('field:') ? group.slice(6) : null;

/** As chaves de grupo de uma tarefa ('' = sem valor). Etiquetas e responsáveis: uma por valor. */
export function groupKeys(task: ViewTask, group: ViewGroup, ctx: ViewContext): string[] {
  if (group === 'none') return [''];
  if (group === 'status') return [task.status];
  if (group === 'priority') return [String(task.priority || 0)];
  if (group === 'label') return task.labels?.length ? [...new Set(task.labels)] : [''];
  if (group === 'assignee') {
    const ids = ctx.assigneesOf(task.id);
    return ids.length ? [...new Set(ids)] : [''];
  }
  const v = fieldValue(task, groupField(group) ?? '');
  return [v === null || v === '' ? '' : String(v)];
}

/** As colunas fixas de cada grupo (as que aparecem mesmo vazias), na ordem. */
export function fixedKeys(
  group: ViewGroup,
  options: { fieldOptions?: string[]; people?: string[] } = {},
): string[] {
  if (group === 'status') return ['todo', 'doing', 'done'];
  if (group === 'priority') return ['3', '2', '1', '0'];
  if (group === 'assignee') return [...(options.people ?? []), ''];
  if (group.startsWith('field:')) return [...(options.fieldOptions ?? []), ''];
  if (group === 'label') return [''];
  return [''];
}

export type TaskGroup<T> = { key: string; tasks: T[] };

/**
 * Agrupa na ordem das chaves fixas; valor que não está nelas (etiqueta, opção apagada) entra antes
 * do "sem valor", em ordem alfabética. Grupo vazio só aparece se for fixo (`keepEmpty`).
 */
export function groupTasks<T extends ViewTask>(
  tasks: readonly T[],
  group: ViewGroup,
  ctx: ViewContext,
  fixed: string[],
  keepEmpty: boolean,
): TaskGroup<T>[] {
  const map = new Map<string, T[]>(fixed.map((k) => [k, []]));
  for (const task of tasks)
    for (const key of groupKeys(task, group, ctx)) {
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
  const extra = [...map.keys()]
    .filter((k) => !fixed.includes(k))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const order = [...fixed.filter((k) => k !== ''), ...extra, ...(fixed.includes('') ? [''] : [])];
  if (!order.includes('') && map.has('')) order.push('');
  return order
    .map((key) => ({ key, tasks: map.get(key) ?? [] }))
    .filter((g) => g.tasks.length > 0 || (keepEmpty && fixed.includes(g.key)));
}

export type MoveResult =
  | { type: 'status'; status: 'todo' | 'doing' | 'done' }
  | {
      type: 'patch';
      patch: { priority?: number; labels?: string[]; custom?: Record<string, unknown> };
    }
  | { type: 'assignee'; remove: string | null; add: string | null };

/**
 * Levar o cartão da coluna `from` para `to` no quadro: o que muda na tarefa. Estado vai pela RPC
 * (concluir dá XP); responsável troca quem saiu pelo que entrou; etiqueta troca uma pela outra.
 */
export function moveTo(
  task: ViewTask,
  group: ViewGroup,
  from: string,
  to: string,
): MoveResult | null {
  if (from === to || group === 'none') return null;
  if (group === 'status')
    return to === 'todo' || to === 'doing' || to === 'done' ? { type: 'status', status: to } : null;
  if (group === 'priority') {
    const p = Number(to);
    return Number.isInteger(p) && p >= 0 && p <= 3
      ? { type: 'patch', patch: { priority: p } }
      : null;
  }
  if (group === 'label') {
    const labels = (task.labels ?? []).filter((l) => l !== from && l !== to);
    return { type: 'patch', patch: { labels: to ? [...labels, to] : labels } };
  }
  if (group === 'assignee') return { type: 'assignee', remove: from || null, add: to || null };
  const id = groupField(group);
  if (!id) return null;
  const custom = { ...asObject(task.custom) };
  if (to) custom[id] = to;
  else delete custom[id];
  return { type: 'patch', patch: { custom } };
}
