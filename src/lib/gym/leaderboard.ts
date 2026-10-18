import { addDays } from '../parser/dates';

// Ranking do desafio do grupo (V6 §15.5, AC10.3): dias ativos (um dia de treino conta uma vez),
// pontos opcionais, empates e sequência. Função pura: o servidor dá os dias de treino de cada um.

export type ActivityDay = { userId: string; day: string; points?: number };

export type BoardEntry = {
  userId: string;
  /** Dias distintos com treino dentro do desafio */
  days: number;
  points: number;
  /** Sequência atual: dias seguidos terminando hoje (ou ontem, se hoje ainda não treinou) */
  streak: number;
  /** Maior sequência dentro do desafio */
  best: number;
  /** Posição; empatados dividem a mesma (1, 1, 3) */
  rank: number;
};

export type ChallengeRange = { start: string; end: string; today: string };

/**
 * Uma linha por participante (mesmo quem não treinou), na ordem do ranking: pelo critério
 * (dias ou pontos), desempate de exibição pela maior sequência e depois pelo id (estável).
 */
export function leaderboard(
  activity: readonly ActivityDay[],
  participants: readonly string[],
  range: ChallengeRange,
  by: 'days' | 'points' = 'days',
): BoardEntry[] {
  const inRange = activity.filter((a) => a.day >= range.start && a.day <= range.end);
  const entries = [...new Set(participants)].map((userId) => {
    const mine = inRange.filter((a) => a.userId === userId);
    const days = [...new Set(mine.map((a) => a.day))].sort();
    return {
      userId,
      days: days.length,
      points: mine.reduce((sum, a) => sum + (a.points ?? 0), 0),
      streak: currentStreak(days, range),
      best: bestStreak(days),
      rank: 0,
    };
  });

  const value = (e: BoardEntry) => (by === 'points' ? e.points : e.days);
  entries.sort(
    (a, b) => value(b) - value(a) || b.best - a.best || a.userId.localeCompare(b.userId),
  );
  entries.forEach((e, i) => {
    e.rank = i > 0 && value(entries[i - 1]) === value(e) ? entries[i - 1].rank : i + 1;
  });
  return entries;
}

/** Dias seguidos até hoje; hoje sem treino ainda não quebra (conta a partir de ontem). */
function currentStreak(days: readonly string[], range: ChallengeRange) {
  const set = new Set(days);
  const last = range.today > range.end ? range.end : range.today;
  let day = set.has(last) ? last : addDays(last, -1);
  let count = 0;
  while (set.has(day) && day >= range.start) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

function bestStreak(sortedDays: readonly string[]) {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sortedDays) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Dias do desafio (início e fim inclusos) e quantos já passaram até hoje. */
export function challengeProgress(range: ChallengeRange) {
  const total = daysBetween(range.start, range.end) + 1;
  const elapsed =
    range.today < range.start ? 0 : Math.min(total, daysBetween(range.start, range.today) + 1);
  return { total, elapsed, left: total - elapsed };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
