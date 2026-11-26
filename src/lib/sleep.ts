import { addDays } from './parser/dates';

/**
 * Sono (SA1, D384): quando dormiu e quando acordou, com o dia de acordar. A duração é conta daqui:
 * acordar "antes" de dormir no relógio quer dizer que passou da meia-noite.
 */
export type SleepLog = { id: string; day: string; bed_time: string; wake_time: string };

export const SLEEP_GOAL_DEFAULT = 480;
export const SLEEP_GOAL_LIMITS = [180, 960] as const;

/** "23:30", "7:05", "7h", "07h30", "22" → minutos desde a meia-noite; null se não for hora. */
export function parseClock(text: string): number | null {
  const m = /^\s*(\d{1,2})(?:\s*(?:[:h])\s*(\d{2})?)?\s*$/i.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos (do banco, 'HH:MM:SS' ou 'HH:MM') → 'HH:MM'. */
export function clockText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Duração em minutos, atravessando a meia-noite quando precisa (sempre entre 1 e 1439). */
export function sleepMinutes(bed: string, wake: string): number {
  const d = toMinutes(wake) - toMinutes(bed);
  return d > 0 ? d : d + 1440;
}

/** "7 h 30 min", "8 h", "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Os últimos 7 dias até hoje (o mais antigo primeiro), somando cochilos do mesmo dia. */
export function sleepWeek(logs: readonly SleepLog[], today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const minutes = logs
      .filter((l) => l.day === day)
      .reduce((s, l) => s + sleepMinutes(l.bed_time, l.wake_time), 0);
    return { day, minutes };
  });
}

/** Média dos dias com registro (0 se nenhum). */
export function sleepAverage(week: readonly { minutes: number }[]): number {
  const days = week.filter((d) => d.minutes > 0);
  return days.length ? Math.round(days.reduce((s, d) => s + d.minutes, 0) / days.length) : 0;
}
