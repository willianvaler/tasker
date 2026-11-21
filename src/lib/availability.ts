import { parseTime } from './parser/quick';
import { weekdayOf, type IsoDate } from './parser/dates';

// Disponibilidade da agenda (AG1, D310): os horários em que a pessoa aceita compromissos, por dia da
// semana (no fuso do perfil), e as exceções por data. Funções puras: o banco guarda os trechos, e a
// conta de "livre num dia" daqui é a mesma que as RPCs da reserva (AG2) e do "achar horário" (AG3)
// vão fazer no servidor.

/** Trecho do dia, 'HH:MM' a 'HH:MM' (o fim é exclusivo). */
export type Interval = { starts: string; ends: string };
/** Dia ISO: 1 = segunda ... 7 = domingo (o `isodow` do Postgres). */
export type WeekRule = Interval & { weekday: number };
export type AvailabilityException = {
  id: string;
  starts_on: IsoDate;
  ends_on: IsoDate;
  /** Sem horário: o dia inteiro fica fora */
  starts: string | null;
  ends: string | null;
  note: string | null;
};
export type Week = Record<number, Interval[]>;

/** Segunda a domingo, a ordem da tela. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** O banco devolve 'HH:MM:SS'. */
export const clock = (time: string) => time.slice(0, 5);

/** Dia ISO de uma data (1 = segunda ... 7 = domingo). */
export const isoWeekday = (date: IsoDate) => weekdayOf(date) || 7;

/** "9", "9h", "9h30", "09:30", "930", "3pm" → 'HH:MM'; "24" ou "24:00" só como fim do dia. */
export function parseClock(text: string, end = false): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  if (end && /^24(?:h|:00|h00)?$/.test(t)) return '24:00';
  if (/^\d{1,2}$/.test(t)) return parseTime(`${t}h`);
  const compact = /^(\d{1,2})(\d{2})$/.exec(t);
  if (compact) return parseTime(`${compact[1]}:${compact[2]}`);
  return parseTime(t);
}

/** Junta trechos que se sobrepõem ou encostam, em ordem. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list
    .map((i) => [toMinutes(i.starts), toMinutes(i.ends)] as const)
    .filter(([a, b]) => a < b)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => ({ starts: fromMinutes(a), ends: fromMinutes(b) }));
}

/** Tira um trecho de uma lista de trechos (já juntos). */
export function subtractInterval(list: Interval[], block: Interval): Interval[] {
  const [ba, bb] = [toMinutes(block.starts), toMinutes(block.ends)];
  const out: Interval[] = [];
  for (const i of list) {
    const [a, b] = [toMinutes(i.starts), toMinutes(i.ends)];
    if (bb <= a || ba >= b) {
      out.push(i);
      continue;
    }
    if (a < ba) out.push({ starts: i.starts, ends: fromMinutes(ba) });
    if (bb < b) out.push({ starts: fromMinutes(bb), ends: i.ends });
  }
  return out;
}

export type DayParse = { ok: true; intervals: Interval[] } | { ok: false };

/**
 * O texto de um dia na tela: "9-12, 14-18", "9h às 12h; 14:00–18:00", "9am to 5pm". Vazio = sem
 * horário (não aceita compromisso). Trechos que se sobrepõem são juntados.
 */
export function parseDayText(text: string): DayParse {
  const pieces = text
    .split(/[,;]|\s+e\s+|\s+and\s+|\s+y\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const intervals: Interval[] = [];
  for (const piece of pieces) {
    const parts = piece.split(/\s*[-–—]\s*|\s+(?:às|as|até|ate|a|to|hasta)\s+/i).filter(Boolean);
    if (parts.length !== 2) return { ok: false };
    const [from, to] = parts;
    const starts = parseClock(from);
    const ends = parseClock(to, true);
    if (!starts || !ends || toMinutes(starts) >= toMinutes(ends)) return { ok: false };
    intervals.push({ starts, ends });
  }
  return { ok: true, intervals: mergeIntervals(intervals) };
}

/** "09:00–12:00, 14:00–18:00" (vazio sem trecho). */
export const formatIntervals = (list: Interval[]) =>
  list.map((i) => `${i.starts}–${i.ends}`).join(', ');

/** Linhas do banco → semana na ordem (trechos juntos por dia). */
export function weekFromRules(rules: WeekRule[]): Week {
  const week: Week = {};
  for (const day of WEEKDAYS)
    week[day] = mergeIntervals(
      rules
        .filter((r) => r.weekday === day)
        .map((r) => ({ starts: clock(r.starts), ends: clock(r.ends) })),
    );
  return week;
}

/** Semana → linhas para o `set_availability` (o `time` do banco aceita '24:00'). */
export function rulesFromWeek(week: Week): WeekRule[] {
  return WEEKDAYS.flatMap((weekday) =>
    mergeIntervals(week[weekday] ?? []).map((i) => ({ weekday, ...i })),
  );
}

/** A exceção vale nesse dia? */
export const exceptionCovers = (e: AvailabilityException, date: IsoDate) =>
  e.starts_on <= date && date <= e.ends_on;

/** Horários em que a pessoa aceita compromisso nesse dia: a semana menos as exceções. */
export function windowsOn(
  date: IsoDate,
  week: Week,
  exceptions: AvailabilityException[],
): Interval[] {
  let list = mergeIntervals(week[isoWeekday(date)] ?? []);
  for (const e of exceptions) {
    if (!exceptionCovers(e, date)) continue;
    if (!e.starts || !e.ends) return [];
    list = subtractInterval(list, { starts: clock(e.starts), ends: clock(e.ends) });
  }
  return list;
}

/** Minutos por semana (para o resumo em Configurações). */
export const weeklyMinutes = (week: Week) =>
  WEEKDAYS.reduce(
    (sum, day) =>
      sum + (week[day] ?? []).reduce((s, i) => s + toMinutes(i.ends) - toMinutes(i.starts), 0),
    0,
  );

/** Segunda a sexta com os trechos de um dia ("Copiar para os dias úteis"). */
export function copyToWeekdays(week: Week, from: number): Week {
  const next: Week = { ...week };
  for (const day of [1, 2, 3, 4, 5]) next[day] = [...(week[from] ?? [])];
  return next;
}
