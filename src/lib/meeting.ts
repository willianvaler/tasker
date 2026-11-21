import { tr } from './i18n-ref';
import { addDays, type IsoDate } from './parser/dates';

// Reuniões (GP1, D313). Uma reunião é uma lista do tipo 'meeting': os itens da pauta são as
// tarefas dela e o resto mora em pages.config.meeting. Funções puras: ler a configuração com
// padrões, achar as ações nas anotações, montar a ata e a próxima reunião da série.

export type MeetingStatus = 'planned' | 'running' | 'done';
export type MeetingRepeat = 'none' | 'weekly' | 'biweekly';

export type MeetingConfig = {
  date: IsoDate | null;
  time: string | null;
  /** Minutos */
  duration: number;
  /** Lugar ou link da chamada */
  place: string | null;
  /** Ids de quem participa (membros do projeto) */
  participants: string[];
  /** Nomes de quem não está no app */
  guests: string[];
  status: MeetingStatus;
  /** Item (tarefa) em discussão */
  current: string | null;
  /** Itens já discutidos, na ordem */
  discussed: string[];
  /** Quem esteve (marcado ao encerrar; ids) */
  present: string[];
  /** Anotações gerais (fora dos itens) */
  notes: string;
  started_at: string | null;
  ended_at: string | null;
  /** A ata gerada (anotação) */
  minutes_note_id: string | null;
  /** Tarefas criadas a partir das ações */
  actions: string[];
  /** Reunião anterior da série (página) e a próxima, quando já criada */
  prev: string | null;
  next: string | null;
  repeat: MeetingRepeat;
};

export const MEETING_DEFAULTS: MeetingConfig = {
  date: null,
  time: null,
  duration: 60,
  place: null,
  participants: [],
  guests: [],
  status: 'planned',
  current: null,
  discussed: [],
  present: [],
  notes: '',
  started_at: null,
  ended_at: null,
  minutes_note_id: null,
  actions: [],
  prev: null,
  next: null,
  repeat: 'none',
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** pages.config → configuração da reunião (o que faltar ou vier errado fica no padrão). */
export function readMeeting(config: unknown): MeetingConfig {
  const raw =
    config && typeof config === 'object' && 'meeting' in config
      ? ((config as { meeting: unknown }).meeting as Record<string, unknown>)
      : null;
  if (!raw || typeof raw !== 'object') return { ...MEETING_DEFAULTS };
  const date = str(raw.date);
  const time = str(raw.time);
  const duration = Number(raw.duration);
  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    duration: Number.isInteger(duration) && duration >= 5 && duration <= 600 ? duration : 60,
    place: str(raw.place),
    participants: strings(raw.participants),
    guests: strings(raw.guests),
    status: raw.status === 'running' || raw.status === 'done' ? raw.status : 'planned',
    current: str(raw.current),
    discussed: strings(raw.discussed),
    present: strings(raw.present),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    started_at: str(raw.started_at),
    ended_at: str(raw.ended_at),
    minutes_note_id: str(raw.minutes_note_id),
    actions: strings(raw.actions),
    prev: str(raw.prev),
    next: str(raw.next),
    repeat: raw.repeat === 'weekly' || raw.repeat === 'biweekly' ? raw.repeat : 'none',
  };
}

/** Junta a reunião ao resto da configuração da lista. */
export const writeMeeting = (config: unknown, meeting: MeetingConfig) => ({
  ...(config && typeof config === 'object' && !Array.isArray(config) ? config : {}),
  meeting,
});

/**
 * Ações escritas nas anotações: cada linha `[ ] fazer X @Ana até sexta` (com ou sem "-" ou "*"
 * na frente) vira o texto da tarefa ("fazer X @Ana até sexta"), que a escrita rápida lê depois.
 * `[x]` já feito fica de fora.
 */
export function findActions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => /^\s*(?:[-*+]\s+)?\[ \]\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((x): x is string => !!x);
}

/** O próximo item a discutir: o primeiro da pauta que ainda não foi. */
export function nextItem(order: string[], discussed: string[], current: string | null) {
  const done = new Set([...discussed, ...(current ? [current] : [])]);
  return order.find((id) => !done.has(id)) ?? null;
}

/** Soma do tempo previsto da pauta. */
export const plannedMinutes = (items: { estimate_minutes: number | null }[]) =>
  items.reduce((sum, i) => sum + (i.estimate_minutes ?? 0), 0);

/** Data da próxima reunião da série (sem repetição: uma semana depois). */
export function nextMeetingDate(date: IsoDate | null, repeat: MeetingRepeat, today: IsoDate) {
  const base = date ?? today;
  return addDays(base, repeat === 'biweekly' ? 14 : 7);
}

export type MinutesInput = {
  title: string;
  date: string | null;
  time: string | null;
  place: string | null;
  present: string[];
  absent: string[];
  items: { title: string; presenter: string | null; notes: string; discussed: boolean }[];
  notes: string;
  actions: { title: string; who: string | null }[];
};

/** A ata em Markdown (vira uma anotação; os textos no idioma da tela). */
export function buildMinutes(input: MinutesInput): string {
  const lines: string[] = [];
  const when = [input.date, input.time].filter(Boolean).join(' ');
  const head = [when || null, input.place].filter(Boolean).join(' · ');
  if (head) lines.push(head, '');
  if (input.present.length)
    lines.push(`**${tr('meeting.minutes.present')}:** ${input.present.join(', ')}`);
  if (input.absent.length)
    lines.push(`**${tr('meeting.minutes.absent')}:** ${input.absent.join(', ')}`);
  if (input.present.length || input.absent.length) lines.push('');
  lines.push(`## ${tr('meeting.minutes.agenda')}`, '');
  input.items.forEach((item, i) => {
    const who = item.presenter ? ` (${item.presenter})` : '';
    const skipped = item.discussed ? '' : ` — ${tr('meeting.minutes.skipped')}`;
    lines.push(`### ${i + 1}. ${item.title}${who}${skipped}`);
    if (item.notes.trim()) lines.push('', item.notes.trim());
    lines.push('');
  });
  if (input.notes.trim())
    lines.push(`## ${tr('meeting.minutes.notes')}`, '', input.notes.trim(), '');
  if (input.actions.length) {
    lines.push(`## ${tr('meeting.minutes.actions')}`, '');
    for (const a of input.actions) lines.push(`- [ ] ${a.title}${a.who ? ` (${a.who})` : ''}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
