// Datas "de calendário" (sem hora) no formato ISO 'YYYY-MM-DD'. As contas são feitas em UTC
// para não sofrer com horário de verão; o fuso do usuário só entra para descobrir o "hoje".

export type IsoDate = string;

/** Hoje no fuso informado, como 'YYYY-MM-DD'. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Dia da semana: 0 = domingo ... 6 = sábado. */
export function weekdayOf(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

/** Próxima ocorrência do dia da semana, contando hoje. */
export function nextWeekday(today: IsoDate, weekday: number): IsoDate {
  return addDays(today, (weekday - weekdayOf(today) + 7) % 7);
}

/** Data válida a partir de dia/mês/ano; null se não existir (ex.: 31/02). */
export function makeDate(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  return fromUtc(d);
}

/** "15/10" vira a próxima vez que esse dia acontece (este ano, ou o próximo se já passou). */
export function nextDayMonth(today: IsoDate, day: number, month: number): IsoDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = makeDate(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return makeDate(year + 1, month, day);
}

// Idioma das datas na interface (o i18n avisa quando muda: setDateLocale). Português por padrão.
export type DateLocale = 'pt-BR' | 'en' | 'es';
let current: DateLocale = 'pt-BR';
export function setDateLocale(locale: string) {
  current = locale.startsWith('en') ? 'en' : locale.startsWith('es') ? 'es' : 'pt-BR';
}
export const dateLocale = () => current;

const WEEKDAY_SHORT: Record<DateLocale, string[]> = {
  'pt-BR': ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
};
const MONTH_SHORT: Record<DateLocale, string[]> = {
  'pt-BR': ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
};
const MONTH_LONG: Record<DateLocale, string[]> = {
  'pt-BR': [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
};
const RELATIVE: Record<DateLocale, [string, string, string]> = {
  'pt-BR': ['Hoje', 'Amanhã', 'Ontem'],
  en: ['Today', 'Tomorrow', 'Yesterday'],
  es: ['Hoy', 'Mañana', 'Ayer'],
};

/** "sex, 17 out" · "Fri, Oct 17" · "vie, 17 oct" */
export function formatShortDate(date: IsoDate, locale: DateLocale = current): string {
  const d = toUtc(date);
  const day = WEEKDAY_SHORT[locale][d.getUTCDay()];
  const month = MONTH_SHORT[locale][d.getUTCMonth()];
  return locale === 'en'
    ? `${day}, ${month} ${d.getUTCDate()}`
    : `${day}, ${d.getUTCDate()} ${month}`;
}

/** Dia da semana curto (0 = domingo): "dom" · "Sun" · "dom" */
export function weekdayShort(weekday: number, locale: DateLocale = current): string {
  return WEEKDAY_SHORT[locale][weekday];
}

/** "novembro de 2026" · "November 2026" · "noviembre de 2026" (mês 'YYYY-MM') */
export function formatMonthYear(month: string, locale: DateLocale = current): string {
  const name = MONTH_LONG[locale][Number(month.slice(5, 7)) - 1];
  return locale === 'en' ? `${name} ${month.slice(0, 4)}` : `${name} de ${month.slice(0, 4)}`;
}

/** Rótulo curto para a interface: "Hoje", "Amanhã", "Ontem", "sex, 17 out" (ano só se for outro). */
export function formatDueDate(date: IsoDate, today: IsoDate, locale: DateLocale = current): string {
  const [todayLabel, tomorrow, yesterday] = RELATIVE[locale];
  if (date === today) return todayLabel;
  if (date === addDays(today, 1)) return tomorrow;
  if (date === addDays(today, -1)) return yesterday;
  const label = formatShortDate(date, locale);
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${date.slice(0, 4)}`;
}

/** Segunda-feira da semana ISO da data. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Chave da semana ISO, igual à do banco: '2026-W41'. */
export function isoWeekKey(date: IsoDate): string {
  // A semana ISO pertence ao ano da sua quinta-feira
  const thursday = addDays(startOfIsoWeek(date), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(startOfIsoWeek(`${year}-01-04`), 3);
  const week =
    Math.round((toUtc(thursday).getTime() - toUtc(firstThursday).getTime()) / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target);
}
