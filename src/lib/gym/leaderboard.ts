import { addDays } from '../parser/dates';

// Ranking do desafio (V6 §15.5, AC10.3, AC15C): dias ativos (um dia de treino conta uma vez),
// atividades, minutos ou pontos, empates e sequência. Função pura: o servidor dá os dias de treino e
// as atividades de cada um. O mesmo critério de public._challenge_scores (o servidor dá o prêmio).

export type Scoring = 'days' | 'activities' | 'minutes' | 'points';
export const SCORINGS: readonly Scoring[] = ['days', 'activities', 'minutes', 'points'];

export type ActivityDay = {
  userId: string;
  day: string;
  /** Pontos já calculados; sem eles, os de activityPoints */
  points?: number;
  minutes?: number;
  sets?: number;
  /** false: só o dia de treino, sem uma atividade (conta nos dias, não nas atividades) */
  activity?: boolean;
};

export type BoardEntry = {
  userId: string;
  /** Dias distintos com treino dentro do desafio */
  days: number;
  activities: number;
  minutes: number;
  points: number;
  /** O valor do critério do desafio */
  score: number;
  /** Sequência atual: dias seguidos terminando hoje (ou ontem, se hoje ainda não treinou) */
  streak: number;
  /** Maior sequência dentro do desafio */
  best: number;
  /** Posição; empatados dividem a mesma (1, 1, 3) */
  rank: number;
};

export type ChallengeRange = { start: string; end: string; today: string };

/**
 * Pontos de um treino: 10 pelo treino, 1 por série feita (sem aquecimento) e 1 a cada 10 minutos.
 * O mesmo que public._activity_points.
 */
export function activityPoints(minutes = 0, sets = 0) {
  return 10 + Math.max(0, sets) + Math.floor(Math.max(0, minutes) / 10);
}

/**
 * Uma linha por participante (mesmo quem não treinou), na ordem do ranking: pelo critério,
 * desempate de exibição pela maior sequência e depois pelo id (estável).
 */
export function leaderboard(
  activity: readonly ActivityDay[],
  participants: readonly string[],
  range: ChallengeRange,
  by: Scoring = 'days',
): BoardEntry[] {
  const inRange = activity.filter((a) => a.day >= range.start && a.day <= range.end);
  const entries = [...new Set(participants)].map((userId) => {
    const mine = inRange.filter((a) => a.userId === userId);
    const acts = mine.filter((a) => a.activity !== false);
    const days = [...new Set(mine.map((a) => a.day))].sort();
    const entry: BoardEntry = {
      userId,
      days: days.length,
      activities: acts.length,
      minutes: acts.reduce((sum, a) => sum + (a.minutes ?? 0), 0),
      points: acts.reduce((sum, a) => sum + (a.points ?? activityPoints(a.minutes, a.sets)), 0),
      score: 0,
      streak: currentStreak(days, range),
      best: bestStreak(days),
      rank: 0,
    };
    entry.score = by === 'days' ? entry.days : entry[by];
    return entry;
  });

  entries.sort((a, b) => b.score - a.score || b.best - a.best || a.userId.localeCompare(b.userId));
  entries.forEach((e, i) => {
    e.rank = i > 0 && entries[i - 1].score === e.score ? entries[i - 1].rank : i + 1;
  });
  return entries;
}

/**
 * As linhas do ranking a partir do challenge_board: as atividades e os dias de treino sem
 * atividade (os de antes do AC15C, se houver).
 */
export function boardActivity(
  rows: readonly {
    user_id: string;
    days: readonly string[];
    activities: readonly { day: string; minutes?: number; sets?: number }[];
  }[],
): ActivityDay[] {
  return rows.flatMap((r) => {
    const acts = r.activities.map((a) => ({
      userId: r.user_id,
      day: a.day,
      minutes: a.minutes ?? 0,
      sets: a.sets ?? 0,
    }));
    const withActivity = new Set(acts.map((a) => a.day));
    const bare = r.days
      .filter((day) => !withActivity.has(day))
      .map((day) => ({ userId: r.user_id, day, activity: false }));
    return [...acts, ...bare];
  });
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

/**
 * Pódio do desafio terminado (AC11): até o 3º lugar pelo critério, só quem treinou, e só quando
 * pelo menos duas pessoas treinaram. O mesmo que public._challenge_podium (o servidor dá os prêmios).
 */
export function podium(entries: readonly BoardEntry[]): Map<string, 1 | 2 | 3> {
  const trained = entries.filter((e) => e.days > 0);
  const places = new Map<string, 1 | 2 | 3>();
  if (trained.length < 2) return places;
  for (const e of trained) if (e.rank <= 3) places.set(e.userId, e.rank as 1 | 2 | 3);
  return places;
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
