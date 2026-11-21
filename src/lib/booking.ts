// Reservas pela página pública da agenda (AG2, D311). Funções puras: o apelido do tipo, os horários
// livres (que vêm do servidor como instantes) agrupados por dia no fuso de quem vê, e o .ics de
// "Adicionar à agenda". A conta de quais horários estão livres é só do servidor (`booking_slots`).

export type AskLevel = 'off' | 'optional' | 'required';

export type BookingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_min: number;
  buffer_before: number;
  buffer_after: number;
  min_notice_min: number;
  max_days: number;
  daily_limit: number | null;
  ask_phone: AskLevel;
  ask_note: AskLevel;
  needs_approval: boolean;
  active: boolean;
};

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'declined';

/** "Conversa de 30 min!" → "conversa-de-30-min" (até 40 caracteres, o que o banco aceita). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export const validSlug = (slug: string) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(slug);

/** Data 'YYYY-MM-DD' e hora 'HH:MM' de um instante no fuso pedido (sem fuso: o do aparelho). */
export function localParts(iso: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export type SlotDay = { date: string; slots: { iso: string; time: string }[] };

/** Horários livres agrupados por dia, em ordem, no fuso de quem vê. */
export function groupSlots(slots: string[], timeZone?: string): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const iso of [...slots].sort((a, b) => Date.parse(a) - Date.parse(b))) {
    const { date, time } = localParts(iso, timeZone);
    const day = days.get(date) ?? { date, slots: [] };
    day.slots.push({ iso, time });
    days.set(date, day);
  }
  return [...days.values()];
}

/** "30 min", "1 h", "1 h 30" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

const icsDate = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Arquivo .ics de um compromisso (horário em UTC; o calendário mostra no fuso de quem abre). */
export function bookingIcs(event: {
  uid: string;
  starts_at: string;
  ends_at: string;
  title: string;
  description?: string;
  url?: string;
  now?: string;
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Questlist//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@questlist`,
    `DTSTAMP:${icsDate(event.now ?? new Date().toISOString())}`,
    `DTSTART:${icsDate(event.starts_at)}`,
    `DTEND:${icsDate(event.ends_at)}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
