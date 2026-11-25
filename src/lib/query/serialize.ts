import type { Condition, Field, Query, Value } from './parse';

// A consulta montada no construtor visual (R2b, D374) volta a ser a frase da linguagem do OB7, no
// idioma da pessoa. O parser lê a frase de volta e dá a mesma consulta (teste de ida e volta).

export type QueryLang = 'pt' | 'en' | 'es';

const VOCAB = {
  pt: {
    tasks: 'tarefas',
    notes: 'anotações',
    list: 'da lista',
    folder: 'da pasta',
    where: 'onde',
    and: 'e',
    open: 'não concluídas',
    done: 'concluídas',
    sort: 'ordenar por',
    desc: 'desc',
    limit: 'limite',
    as: 'como',
    table: 'tabela',
    count: 'contagem',
    contains: 'contém',
    today: 'hoje',
    yes: 'verdadeiro',
    no: 'falso',
    fields: {
      tag: 'etiqueta',
      due: 'vence',
      priority: 'prioridade',
      title: 'título',
      status: 'status',
      created: 'criada',
      updated: 'atualizada',
      completed: 'concluída_em',
    },
  },
  en: {
    tasks: 'tasks',
    notes: 'notes',
    list: 'in list',
    folder: 'in folder',
    where: 'where',
    and: 'and',
    open: 'not done',
    done: 'done',
    sort: 'sort by',
    desc: 'desc',
    limit: 'limit',
    as: 'as',
    table: 'table',
    count: 'count',
    contains: 'contains',
    today: 'today',
    yes: 'true',
    no: 'false',
    fields: {
      tag: 'tag',
      due: 'due',
      priority: 'priority',
      title: 'title',
      status: 'status',
      created: 'created',
      updated: 'updated',
      completed: 'completed_at',
    },
  },
  es: {
    tasks: 'tareas',
    notes: 'notas',
    list: 'de la lista',
    folder: 'de la carpeta',
    where: 'donde',
    and: 'y',
    open: 'no completadas',
    done: 'completadas',
    sort: 'ordenar por',
    desc: 'desc',
    limit: 'limite',
    as: 'como',
    table: 'tabla',
    count: 'conteo',
    contains: 'contiene',
    today: 'hoy',
    yes: 'sí',
    no: 'falso',
    fields: {
      tag: 'etiqueta',
      due: 'vencimiento',
      priority: 'prioridad',
      title: 'nombre',
      status: 'estado',
      created: 'creada',
      updated: 'actualizada',
      completed: 'completada_en',
    },
  },
} as const;

export function langOf(locale: string): QueryLang {
  return locale.startsWith('en') ? 'en' : locale.startsWith('es') ? 'es' : 'pt';
}

const quote = (s: string) => (s.includes('"') ? `'${s}'` : `"${s}"`);

export function fieldText(field: Field, lang: QueryLang): string {
  return field.kind === 'prop' ? `props.${field.name}` : VOCAB[lang].fields[field.kind];
}

export function valueText(value: Value, lang: QueryLang): string {
  const v = VOCAB[lang];
  switch (value.kind) {
    case 'text':
      return quote(value.value);
    case 'number':
      return String(value.value);
    case 'date':
      return value.value;
    case 'bool':
      return value.value ? v.yes : v.no;
    case 'day':
      return value.offset === 0
        ? v.today
        : `${v.today}${value.offset > 0 ? '+' : '-'}${Math.abs(value.offset)}`;
  }
}

function conditionText(c: Condition, lang: QueryLang): string {
  const op = c.op === 'contains' ? VOCAB[lang].contains : c.op;
  return `${fieldText(c.field, lang)} ${op} ${valueText(c.value, lang)}`;
}

/** A consulta → a frase, no idioma pedido */
export function queryToText(q: Query, lang: QueryLang = 'pt'): string {
  const v = VOCAB[lang];
  const parts: string[] = [q.source === 'tasks' ? v.tasks : v.notes];
  for (const l of q.lists) parts.push(`${v.list} ${quote(l)}`);
  for (const f of q.folders) parts.push(`${v.folder} ${quote(f)}`);
  if (q.conditions.length)
    parts.push(`${v.where} ${q.conditions.map((c) => conditionText(c, lang)).join(` ${v.and} `)}`);
  if (q.source === 'tasks' && q.done !== null) parts.push(q.done ? v.done : v.open);
  if (q.sort) parts.push(`${v.sort} ${fieldText(q.sort.field, lang)}${q.sort.desc ? ` ${v.desc}` : ''}`);
  if (q.limit !== null) parts.push(`${v.limit} ${q.limit}`);
  if (q.view !== 'list') parts.push(`${v.as} ${q.view === 'table' ? v.table : v.count}`);
  return parts.join(' ');
}
