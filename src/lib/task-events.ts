// Auditoria do fluxo (V3 §2.7): o texto de cada evento de `task_events`. Função pura, com teste;
// as frases moram no i18n (events.*).

export const EVENT_KINDS = [
  'created',
  'restored',
  'renamed',
  'assigned',
  'unassigned',
  'started',
  'stopped',
  'ready',
  'blocked',
  'completed',
  'reopened',
  'forced',
  'dependency_added',
  'dependency_removed',
  'moved',
  'deleted',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type TaskEvent = {
  id: string;
  task_id: string;
  root_id: string;
  user_id: string | null;
  kind: string;
  at: string;
  payload: unknown;
  actor?: { display_name: string } | null;
};

type Params = Record<string, string | number>;

/** Chave do i18n e variáveis para "Greg concluiu", "ficou pronta (Comprar carvão concluída)"… */
export function eventMessage(
  event: Pick<TaskEvent, 'kind' | 'payload' | 'actor'>,
  someone: string,
): { key: `events.${EventKind}` | 'events.other'; params: Params } {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const params: Params = {
    who: event.actor?.display_name || someone,
    title: text(p.title),
    page: text(p.page),
    from: text(p.from),
    to: text(p.to),
    name: text(p.name),
    prereq: text(p.prereq),
    lag: typeof p.lag === 'number' ? p.lag : 0,
    action: text(p.action),
  };
  const kind = (EVENT_KINDS as readonly string[]).includes(event.kind)
    ? (event.kind as EventKind)
    : null;
  if (!kind) return { key: 'events.other', params };
  // Forçar: iniciar ou concluir
  if (kind === 'forced')
    return { key: 'events.forced', params: { ...params, context: params.action } };
  return { key: `events.${kind}`, params };
}

/** CSV da linha do tempo (data, pessoa, tipo, tarefa, detalhe). */
export function eventsCsv(
  rows: readonly { at: string; who: string; kind: string; title: string; text: string }[],
  header: readonly string[],
) {
  const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows.map((r) => [r.at, r.who, r.kind, r.title, r.text])]
    .map((line) => line.map(cell).join(','))
    .join('\n');
}

/** Filtros por tipo da linha do tempo. */
export const EVENT_GROUPS = {
  progress: ['started', 'stopped', 'completed', 'reopened', 'forced'],
  flow: ['ready', 'blocked', 'dependency_added', 'dependency_removed'],
  people: ['assigned', 'unassigned'],
  changes: ['created', 'restored', 'renamed', 'moved', 'deleted'],
} as const satisfies Record<string, readonly EventKind[]>;
export type EventGroup = keyof typeof EVENT_GROUPS;

/** Agrupa por dia (a chave é a data local 'YYYY-MM-DD'), mantendo a ordem. */
export function byDay<T extends { at: string }>(
  events: readonly T[],
  dayOf: (at: string) => string,
) {
  const days: { day: string; events: T[] }[] = [];
  for (const e of events) {
    const day = dayOf(e.at);
    const last = days[days.length - 1];
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }
  return days;
}
