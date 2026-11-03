// Linguagem de consulta das anotações (OB7, ESCOPO_V11 §5, D292): pequena e fechada, nada de
// código. As palavras valem nos três idiomas, misturadas à vontade. Exemplos:
//
//   tarefas onde etiqueta = casa e vence <= hoje+7 ordenar por vencimento
//   anotações onde etiqueta = leitura e props.nota >= 4 como tabela
//   tarefas da lista "Mercado" não concluídas
//   tasks in list "Groceries" where priority >= 2 sort by due desc limit 5 as count
//
// Função pura, com testes (lib/query/__tests__).

export type Source = 'tasks' | 'notes';
export type FieldName =
  'tag' | 'due' | 'priority' | 'title' | 'status' | 'created' | 'updated' | 'completed';
export type Field = { kind: FieldName } | { kind: 'prop'; name: string };
export type Op = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'contains';
export type Value =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'day'; offset: number }
  | { kind: 'date'; value: string }
  | { kind: 'bool'; value: boolean };
export type Condition = { field: Field; op: Op; value: Value };
export type View = 'list' | 'table' | 'count';

export type Query = {
  source: Source;
  /** Nomes de lista (`da lista "X"`) e de pasta ou projeto (`da pasta "X"`) */
  lists: string[];
  folders: string[];
  conditions: Condition[];
  /** `não concluídas` (false), `concluídas` (true) ou nada (null) */
  done: boolean | null;
  sort: { field: Field; desc: boolean } | null;
  limit: number | null;
  view: View;
};

export type QueryError =
  | { code: 'empty' }
  | { code: 'source'; word: string }
  | { code: 'field'; word: string }
  | { code: 'operator'; word: string }
  | { code: 'value'; word: string }
  | { code: 'unexpected'; word: string }
  | { code: 'limit'; word: string }
  | { code: 'view'; word: string }
  | { code: 'notesDone' };

export type ParseResult = { ok: true; query: Query } | { ok: false; error: QueryError };

/** Sem acento e em minúsculas: as palavras-chave comparam assim */
export function fold(word: string) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const words = (...list: string[]) => new Set(list.map(fold));

const SOURCES: Record<string, Source> = {};
for (const w of ['tarefas', 'tarefa', 'tasks', 'task', 'tareas', 'tarea'])
  SOURCES[fold(w)] = 'tasks';
for (const w of ['anotações', 'anotação', 'notas', 'nota', 'notes', 'note'])
  SOURCES[fold(w)] = 'notes';

const FIELDS: Record<string, FieldName> = {};
const field = (name: FieldName, ...list: string[]) => {
  for (const w of list) FIELDS[fold(w)] = name;
};
field('tag', 'etiqueta', 'etiquetas', 'tag', 'tags');
field('due', 'vence', 'vencimento', 'prazo', 'data', 'due', 'date', 'vencimiento', 'fecha');
field('priority', 'prioridade', 'priority', 'prioridad');
field('title', 'título', 'titulo', 'nome', 'title', 'name', 'nombre');
field('status', 'status', 'estado', 'situação');
field('created', 'criada', 'criado', 'criação', 'created', 'creada', 'creado', 'creación');
field('updated', 'atualizada', 'editada', 'updated', 'modified', 'actualizada', 'modificada');
field('completed', 'concluída_em', 'feita_em', 'completed_at', 'done_at', 'completada_en');

const WHERE = words('onde', 'com', 'where', 'with', 'donde', 'con');
const AND = words('e', 'and', 'y', '&&');
const SKIP = words('da', 'do', 'de', 'na', 'no', 'em', 'from', 'in', 'of', 'la', 'el', 'en', 'del');
const LIST = words('lista', 'list', 'página', 'page');
const FOLDER = words('pasta', 'projeto', 'folder', 'project', 'carpeta', 'proyecto');
const NOT = words('não', 'nao', 'not', 'no', 'sem');
const DONE = words(
  'concluídas',
  'concluída',
  'concluidos',
  'feitas',
  'feitos',
  'done',
  'completed',
  'completadas',
  'completada',
  'hechas',
);
const OPEN = words(
  'abertas',
  'aberta',
  'pendentes',
  'pendente',
  'open',
  'pending',
  'abiertas',
  'pendientes',
);
const SORT = words('ordenar', 'ordenado', 'order', 'sort', 'orden');
const BY = words('por', 'by', 'pelo', 'pela');
const DESC = words('desc', 'decrescente', 'descendente', 'descending', 'maior');
const ASC = words('asc', 'crescente', 'ascendente', 'ascending', 'menor');
const LIMIT = words('limite', 'limit', 'máximo', 'max', 'primeiras', 'primeiros', 'first', 'top');
const AS = words('como', 'as', 'em', 'en', 'mostrar', 'show', 'ver');
const VIEWS: Record<string, View> = {};
for (const w of ['lista', 'list']) VIEWS[fold(w)] = 'list';
for (const w of ['tabela', 'table', 'tabla']) VIEWS[fold(w)] = 'table';
for (const w of ['contagem', 'contar', 'total', 'count', 'número', 'conteo', 'recuento'])
  VIEWS[fold(w)] = 'count';
const CONTAINS = words('contém', 'contem', 'contains', 'has', 'tem', 'contiene', 'tiene', '~');
const TODAY = words('hoje', 'today', 'hoy');
const TOMORROW = words('amanhã', 'tomorrow', 'mañana');
const YESTERDAY = words('ontem', 'yesterday', 'ayer');
const TRUE = words('sim', 'verdadeiro', 'true', 'yes', 'sí', 'si');
const FALSE = words('não', 'nao', 'falso', 'false', 'no');
const PRIORITY_WORDS: Record<string, number> = {};
for (const [w, n] of [
  ['alta', 3],
  ['high', 3],
  ['média', 2],
  ['media', 2],
  ['medium', 2],
  ['baixa', 1],
  ['low', 1],
  ['baja', 1],
  ['nenhuma', 0],
  ['none', 0],
  ['ninguna', 0],
] as const)
  PRIORITY_WORDS[fold(w)] = n;
const STATUS_WORDS: Record<string, string> = {};
for (const [w, s] of [
  ['aberta', 'todo'],
  ['afazer', 'todo'],
  ['todo', 'todo'],
  ['pendiente', 'todo'],
  ['andamento', 'doing'],
  ['fazendo', 'doing'],
  ['doing', 'doing'],
  ['progreso', 'doing'],
  ['concluída', 'done'],
  ['feita', 'done'],
  ['done', 'done'],
  ['completada', 'done'],
] as const)
  STATUS_WORDS[fold(w)] = s;

type Token = { text: string; quoted: boolean; op: boolean };

/** Palavras, "texto entre aspas" e operadores (= != <> < <= > >=) */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /"([^"]*)"|'([^']*)'|“([^”]*)”|(<=|>=|!=|<>|=|<|>|~)|([^\s"'“”=<>!~]+)/g;
  for (const m of text.matchAll(re)) {
    if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined)
      out.push({ text: m[1] ?? m[2] ?? m[3] ?? '', quoted: true, op: false });
    else if (m[4]) out.push({ text: m[4] === '<>' ? '!=' : m[4], quoted: false, op: true });
    else if (m[5]) out.push({ text: m[5], quoted: false, op: false });
  }
  return out;
}

function parseField(word: string): Field | null {
  const lower = word.toLowerCase();
  for (const prefix of ['props.', 'prop.', 'propriedade.', 'propiedad.', 'property.'])
    if (lower.startsWith(prefix) && word.length > prefix.length)
      return { kind: 'prop', name: word.slice(prefix.length) };
  const name = FIELDS[fold(word)];
  return name ? { kind: name } : null;
}

const DAY_EXPR = /^([\p{L}]+)(?:([+-])(\d{1,4}))?$/u;

function parseValue(
  tokens: Token[],
  at: number,
  field: Field,
): { value: Value; next: number } | null {
  const token = tokens[at];
  if (!token || token.op) return null;
  if (token.quoted) return { value: { kind: 'text', value: token.text }, next: at + 1 };
  const word = token.text;
  // hoje, hoje+7, hoje - 3, amanhã, ontem
  const day = DAY_EXPR.exec(fold(word));
  if (day) {
    const base = TODAY.has(day[1])
      ? 0
      : TOMORROW.has(day[1])
        ? 1
        : YESTERDAY.has(day[1])
          ? -1
          : null;
    if (base !== null) {
      let offset = base + (day[3] ? Number(day[3]) * (day[2] === '-' ? -1 : 1) : 0);
      let next = at + 1;
      // "hoje + 7", com espaços
      const sign = tokens[next]?.text;
      const amount = tokens[next + 1]?.text;
      if (!day[2] && (sign === '+' || sign === '-') && amount && /^\d{1,4}$/.test(amount)) {
        offset += Number(amount) * (sign === '-' ? -1 : 1);
        next += 2;
      } else if (!day[2] && sign && /^[+-]\d{1,4}$/.test(sign)) {
        offset += Number(sign);
        next += 1;
      }
      return { value: { kind: 'day', offset }, next };
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(word))
    return { value: { kind: 'date', value: word }, next: at + 1 };
  if (/^-?\d+([.,]\d+)?$/.test(word))
    return { value: { kind: 'number', value: Number(word.replace(',', '.')) }, next: at + 1 };
  const folded = fold(word);
  if (field.kind === 'priority' && folded in PRIORITY_WORDS)
    return { value: { kind: 'number', value: PRIORITY_WORDS[folded] }, next: at + 1 };
  if (field.kind === 'status' && folded in STATUS_WORDS)
    return { value: { kind: 'text', value: STATUS_WORDS[folded] }, next: at + 1 };
  if (TRUE.has(folded)) return { value: { kind: 'bool', value: true }, next: at + 1 };
  if (FALSE.has(folded) && field.kind === 'prop')
    return { value: { kind: 'bool', value: false }, next: at + 1 };
  return { value: { kind: 'text', value: word }, next: at + 1 };
}

export function parseQuery(text: string): ParseResult {
  const tokens = tokenize(text.replace(/\n/g, ' '));
  if (tokens.length === 0) return { ok: false, error: { code: 'empty' } };
  const first = tokens[0];
  const source = first.quoted ? undefined : SOURCES[fold(first.text)];
  if (!source) return { ok: false, error: { code: 'source', word: first.text } };
  const query: Query = {
    source,
    lists: [],
    folders: [],
    conditions: [],
    done: null,
    sort: null,
    limit: null,
    view: 'list',
  };
  let i = 1;
  const fail = (error: QueryError): ParseResult => ({ ok: false, error });
  const word = () => (tokens[i] && !tokens[i].quoted ? fold(tokens[i].text) : '');

  const condition = (): QueryError | null => {
    const token = tokens[i];
    if (!token) return { code: 'field', word: '' };
    const f = token.quoted ? null : parseField(token.text);
    if (!f) return { code: 'field', word: token.text };
    i++;
    const opToken = tokens[i];
    let op: Op | null = null;
    if (opToken?.op) op = opToken.text === '~' ? 'contains' : (opToken.text as Op);
    else if (opToken && !opToken.quoted && CONTAINS.has(fold(opToken.text))) op = 'contains';
    if (!op) return { code: 'operator', word: opToken?.text ?? '' };
    i++;
    const parsed = parseValue(tokens, i, f);
    if (!parsed) return { code: 'value', word: tokens[i]?.text ?? '' };
    i = parsed.next;
    query.conditions.push({ field: f, op, value: parsed.value });
    return null;
  };

  while (i < tokens.length) {
    const w = word();
    if (tokens[i].quoted) return fail({ code: 'unexpected', word: tokens[i].text });
    // "da lista", "de la carpeta", "in list": as preposições antes de lista ou pasta
    if (SKIP.has(w)) {
      let k = i;
      while (tokens[k] && !tokens[k].quoted && SKIP.has(fold(tokens[k].text))) k++;
      const next = fold(tokens[k]?.text ?? '');
      if (LIST.has(next) || FOLDER.has(next)) {
        i = k;
        continue;
      }
    }
    if (LIST.has(w) || FOLDER.has(w)) {
      const name = tokens[i + 1];
      if (!name || name.op) return fail({ code: 'value', word: name?.text ?? '' });
      (LIST.has(w) ? query.lists : query.folders).push(name.text);
      i += 2;
      continue;
    }
    if (WHERE.has(w) || AND.has(w)) {
      i++;
      const error = condition();
      if (error) return fail(error);
      continue;
    }
    if (NOT.has(w) && DONE.has(fold(tokens[i + 1]?.text ?? ''))) {
      query.done = false;
      i += 2;
      continue;
    }
    if (DONE.has(w)) {
      query.done = true;
      i++;
      continue;
    }
    if (OPEN.has(w)) {
      query.done = false;
      i++;
      continue;
    }
    if (SORT.has(w)) {
      i++;
      if (BY.has(word())) i++;
      const token = tokens[i];
      const f = token && !token.quoted ? parseField(token.text) : null;
      if (!f) return fail({ code: 'field', word: token?.text ?? '' });
      i++;
      let desc = false;
      if (DESC.has(word())) {
        desc = true;
        i++;
      } else if (ASC.has(word())) i++;
      query.sort = { field: f, desc };
      continue;
    }
    if (LIMIT.has(w)) {
      const n = tokens[i + 1]?.text ?? '';
      if (!/^\d{1,4}$/.test(n) || Number(n) < 1) return fail({ code: 'limit', word: n });
      query.limit = Math.min(Number(n), 500);
      i += 2;
      continue;
    }
    if (AS.has(w) && fold(tokens[i + 1]?.text ?? '') in VIEWS) {
      query.view = VIEWS[fold(tokens[i + 1].text)];
      i += 2;
      continue;
    }
    // Uma condição sem o "onde" na frente (ex.: "tarefas etiqueta = casa")
    if (parseField(tokens[i].text) && tokens[i + 1]?.op) {
      const error = condition();
      if (error) return fail(error);
      continue;
    }
    return fail({ code: 'unexpected', word: tokens[i].text });
  }
  if (query.source === 'notes' && query.done !== null) return fail({ code: 'notesDone' });
  return { ok: true, query };
}

/**
 * A consulta tem um filtro que não varre o banco todo (D70): lista, pasta, etiqueta ou data. Para
 * as anotações, que já estão inteiras no aparelho, vale também título ou propriedade.
 */
export function isSelective(query: Query): boolean {
  if (query.lists.length || query.folders.length) return true;
  const kinds = query.conditions.filter((c) => c.op !== '!=').map((c) => c.field.kind);
  const dated = ['due', 'created', 'updated', 'completed'];
  if (kinds.some((k) => k === 'tag' || dated.includes(k))) return true;
  return query.source === 'notes' && kinds.some((k) => k === 'prop' || k === 'title');
}
