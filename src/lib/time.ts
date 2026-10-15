import { addDays, makeDate, type IsoDate } from './parser/dates';
import { parseDuration } from './task-tree';

// Lançamento de tempo à mão (K3, D131): o dia é sempre do passado ("ontem", "14/10" = o último
// 14/10 que já passou), ao contrário da captura, que olha para a frente.

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const WORDS: Record<string, number> = {
  hoje: 0,
  today: 0,
  hoy: 0,
  ontem: -1,
  yesterday: -1,
  ayer: -1,
  anteontem: -2,
  anteayer: -2,
};

function pastDay(text: string, today: IsoDate): IsoDate | null {
  const word = fold(text);
  if (word in WORDS) return addDays(today, WORDS[word]);
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
  if (!m) return null;
  const year = Number(today.slice(0, 4));
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (m[3]) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return makeDate(y, month, day);
  }
  const date = makeDate(year, month, day);
  if (!date) return null;
  return date <= today ? date : makeDate(year - 1, month, day);
}

/** "45m", "1h30 ontem", "30 14/10" → minutos e dia (null = agora). */
export function parseTimeInput(text: string, today: IsoDate) {
  const [first, ...rest] = text.trim().split(/\s+/);
  const minutes = first ? parseDuration(first) : null;
  if (!minutes || minutes > 1440) return null;
  if (rest.length === 0) return { minutes, day: null };
  const day = pastDay(rest.join(' '), today);
  return day && day <= today ? { minutes, day } : null;
}
