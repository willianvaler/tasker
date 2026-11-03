// Nota do dia e modelos de anotação (OB5, ESCOPO_V11 §4, D290). Funções puras, com testes.
//
// A nota do dia é uma anotação comum, sem pasta, com o título AAAA-MM-DD (o dia no fuso do perfil,
// pelo useToday). Os modelos são anotações marcadas (`is_template`); ao criar a partir de um, as
// variáveis {{data}}, {{hora}} e {{titulo}} (também em inglês e espanhol) viram o valor do momento.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** O título é um dia (AAAA-MM-DD) */
export function isDayTitle(title: string) {
  return DAY.test(title.trim());
}

type NoteLike = {
  id: string;
  title: string;
  folder_id: string | null;
  is_template?: boolean;
  created_at: string;
};

/** É uma nota do dia: sem pasta, não é modelo e o título é uma data */
export function isDailyNote(note: NoteLike) {
  return !note.folder_id && !note.is_template && isDayTitle(note.title);
}

// O banco do aparelho guarda "2026-11-03 10:00Z" e o app grava "2026-11-03T10:00Z"
const stamp = (at: string) => at.replace(' ', 'T');

/** A nota do dia `date` (a mais antiga, se houver duas: duas criadas sem internet em aparelhos diferentes) */
export function findDailyNote<T extends NoteLike>(
  notes: readonly T[],
  date: string,
): T | undefined {
  let found: T | undefined;
  for (const n of notes)
    if (
      isDailyNote(n) &&
      n.title.trim() === date &&
      (!found || stamp(n.created_at) < stamp(found.created_at))
    )
      found = n;
  return found;
}

/** Os dias que têm nota (para o ponto no calendário), dia → id */
export function dailyNoteDays(notes: readonly NoteLike[]): Record<string, string> {
  const out: Record<string, string> = {};
  const sorted = [...notes].sort((a, b) => stamp(a.created_at).localeCompare(stamp(b.created_at)));
  for (const n of sorted) if (isDailyNote(n) && !out[n.title.trim()]) out[n.title.trim()] = n.id;
  return out;
}

export type TemplateValues = {
  /** Dia, AAAA-MM-DD */
  date: string;
  /** Hora, HH:MM */
  time: string;
  title: string;
};

const NAMES: Record<string, keyof TemplateValues> = {
  data: 'date',
  date: 'date',
  fecha: 'date',
  hoje: 'date',
  today: 'date',
  hoy: 'date',
  hora: 'time',
  time: 'time',
  titulo: 'title',
  title: 'title',
};

const VARIABLE = /\{\{\s*([\p{L}]+)\s*\}\}/gu;

/** Troca as variáveis conhecidas; as outras ficam como estão (pode ser texto de verdade) */
export function renderTemplate(text: string, values: TemplateValues) {
  return text.replace(VARIABLE, (whole, raw: string) => {
    const key = NAMES[raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')];
    return key ? values[key] : whole;
  });
}

/** Hora HH:MM no fuso (o "agora" entra de fora para o teste) */
export function timeIn(timeZone: string, now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/** "data, hora, titulo" → "{{data}}, {{hora}}, {{titulo}}" (o i18n trocaria as chaves no texto) */
export function templateVars(names: string) {
  return names
    .split(',')
    .map((n) => `{{${n.trim()}}}`)
    .join(', ');
}
