import { addDays, isoWeekKey, todayIn, weekdayOf, type IsoDate } from '../parser/dates';
import { groupByDay } from './history';
import { best1Rm } from './one-rm';
import { volumeKg } from './units';

// Painel do treinador (AC13, V6 §11): o diário do aluno numa página enviada, resumido por
// exercício. Recordes vêm do servidor (`records` de cada série); 1RM, volume, estagnação e
// aderência ao plano da semana são contas daqui, sobre as séries.

export type CoachSet = {
  task_id: string | null;
  exercise_id: string | null;
  exercise_name: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  warmup: boolean;
  performed_at: string;
  records: readonly string[];
};

/** O que mede o progresso do exercício, na ordem de preferência */
export type ProgressMetric = 'one_rm' | 'reps' | 'duration' | 'distance';

export type Stagnation = {
  /** Primeiro dia das sessões sem progresso */
  since: IsoDate;
  sessions: number;
  /** O melhor de antes, que nenhuma das últimas passou */
  best: number;
};

export type ExerciseSummary = {
  key: string;
  name: string;
  sessions: number;
  lastDay: IsoDate;
  metric: ProgressMetric | null;
  /** O melhor 1RM estimado e a série de onde veio */
  best1Rm: { oneRm: number; weightKg: number; reps: number } | null;
  /** Séries com recorde */
  records: number;
  /** Volume no período recente (kg × repetições, sem aquecimento) */
  recentVolumeKg: number;
  stagnation: Stagnation | null;
};

export type CoachSummary = {
  exercises: ExerciseSummary[];
  records: number;
  recentVolumeKg: number;
  /** Dias com alguma série que conta */
  days: IsoDate[];
};

/** Sem progresso em tantas sessões seguidas é estagnação (V6 §11) */
export const STAGNATION_SESSIONS = 3;
/** Período de "recente" para o volume e a aderência */
export const RECENT_DAYS = 28;

type DaySets = { day: IsoDate; sets: CoachSet[] };

function metricOf(sets: CoachSet[], metric: ProgressMetric): number | null {
  if (metric === 'one_rm') return best1Rm(sets)?.oneRm ?? null;
  const pick = (s: CoachSet) =>
    metric === 'reps' ? s.reps : metric === 'duration' ? s.duration_seconds : s.distance_m;
  const values = sets.map(pick).filter((v): v is number => v != null && v > 0);
  return values.length ? Math.max(...values) : null;
}

/** A medida do exercício: 1RM se alguma série tem carga, senão repetições, tempo ou distância. */
export function progressMetric(sets: CoachSet[]): ProgressMetric | null {
  for (const metric of ['one_rm', 'reps', 'duration', 'distance'] as const)
    if (metricOf(sets, metric) != null) return metric;
  return null;
}

/**
 * Estagnação: as últimas `window` sessões não passaram do melhor das anteriores. Precisa de ao
 * menos uma sessão antes delas (a primeira é o ponto de partida). Sessões do mais velho para o
 * mais novo.
 */
export function stagnation(
  sessions: { day: IsoDate; value: number }[],
  window = STAGNATION_SESSIONS,
): Stagnation | null {
  if (sessions.length < window + 1) return null;
  const before = sessions.slice(0, sessions.length - window);
  const last = sessions.slice(sessions.length - window);
  const best = Math.max(...before.map((s) => s.value));
  if (Math.max(...last.map((s) => s.value)) > best) return null;
  return { since: last[0].day, sessions: window, best };
}

function summarize(key: string, days: DaySets[], since: IsoDate): ExerciseSummary {
  const all = days.flatMap((d) => d.sets);
  const metric = progressMetric(all);
  const best = best1Rm(all);
  const ordered = [...days].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const series = metric
    ? ordered
        .map((d) => ({ day: d.day, value: metricOf(d.sets, metric) }))
        .filter((s): s is { day: IsoDate; value: number } => s.value != null)
    : [];
  const latest = ordered[ordered.length - 1];
  return {
    key,
    name: latest.sets[latest.sets.length - 1].exercise_name,
    sessions: days.length,
    lastDay: latest.day,
    metric,
    best1Rm:
      best && best.set.weight_kg != null && best.set.reps != null
        ? { oneRm: best.oneRm, weightKg: best.set.weight_kg, reps: best.set.reps }
        : null,
    records: all.filter((s) => s.records.length > 0).length,
    recentVolumeKg: volumeKg(ordered.filter((d) => d.day >= since).flatMap((d) => d.sets)),
    stagnation: stagnation(series),
  };
}

/**
 * O resumo do aluno: um item por exercício (o ligado à Biblioteca ou, sem ele, o item da
 * página), com os estagnados primeiro e depois os mais recentes.
 */
export function coachSummary(sets: CoachSet[], timeZone: string, today: IsoDate): CoachSummary {
  const work = sets.filter((s) => !s.warmup);
  const since = addDays(today, -(RECENT_DAYS - 1));
  const byExercise = new Map<string, CoachSet[]>();
  for (const set of work) {
    const key = set.exercise_id ?? set.task_id ?? set.exercise_name;
    const list = byExercise.get(key);
    if (list) list.push(set);
    else byExercise.set(key, [set]);
  }
  const exercises = [...byExercise.entries()]
    .map(([key, list]) =>
      summarize(
        key,
        groupByDay(list, timeZone).map((d) => ({ day: d.day, sets: d.sets })),
        since,
      ),
    )
    .sort(
      (a, b) =>
        Number(!!b.stagnation) - Number(!!a.stagnation) ||
        (a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0) ||
        a.name.localeCompare(b.name),
    );
  const days = [...new Set(work.map((s) => todayIn(timeZone, new Date(s.performed_at))))].sort();
  return {
    exercises,
    records: exercises.reduce((n, e) => n + e.records, 0),
    recentVolumeKg: exercises.reduce((n, e) => n + e.recentVolumeKg, 0),
    days,
  };
}

/**
 * Aderência ao plano da semana (`pages.train_days`) nos últimos 28 dias: em cada semana, os dias
 * treinados contam até o número de dias previstos nela (treinar em outro dia da semana vale; a
 * mais não passa do previsto). Sem plano, null.
 */
export function planAdherence(
  days: readonly IsoDate[],
  trainDays: readonly number[] | null | undefined,
  today: IsoDate,
  windowDays = RECENT_DAYS,
): { done: number; expected: number } | null {
  if (!trainDays?.length) return null;
  const since = addDays(today, -(windowDays - 1));
  const planned = new Map<string, number>();
  for (let day = since; day <= today; day = addDays(day, 1))
    if (trainDays.includes(weekdayOf(day))) {
      const week = isoWeekKey(day);
      planned.set(week, (planned.get(week) ?? 0) + 1);
    }
  const trained = new Map<string, number>();
  for (const day of new Set(days))
    if (day >= since && day <= today) {
      const week = isoWeekKey(day);
      trained.set(week, (trained.get(week) ?? 0) + 1);
    }
  let done = 0;
  let expected = 0;
  for (const [week, count] of planned) {
    expected += count;
    done += Math.min(count, trained.get(week) ?? 0);
  }
  return { done, expected };
}
