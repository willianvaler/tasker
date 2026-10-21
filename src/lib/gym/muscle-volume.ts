import { convertEffort, type EffortScale } from './effort';
import { isoWeekKey, todayIn, type IsoDate } from '../parser/dates';

// Trabalho por músculo e volume por semana (AC8.2, V6 §7). O trabalho de um músculo é o número de
// séries que contam (aquecimento fora): 1 quando é o alvo do exercício, ½ quando é sinergista. O
// mapa muscular sombreia por ele e lista os que ficaram sem nada no período.

/** Partes do desenho (MuscleMap) que são músculo, e o que cada nome da nossa base acende. */
export const MUSCLE_SLUGS = [
  'chest',
  'deltoids',
  'rotatorCuff',
  'biceps',
  'triceps',
  'forearm',
  'abs',
  'obliques',
  'serratus',
  'trapezius',
  'upperBack',
  'rhomboids',
  'lowerBack',
  'gluteal',
  'hipFlexors',
  'quadriceps',
  'adductors',
  'hamstring',
  'calves',
  'tibialis',
  'neck',
] as const;
export type MuscleSlug = (typeof MUSCLE_SLUGS)[number];

const BY_NAME: Record<string, MuscleSlug[]> = {
  chest: ['chest'],
  shoulders: ['deltoids', 'rotatorCuff'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs'],
  obliques: ['obliques'],
  serratus: ['serratus'],
  traps: ['trapezius'],
  upper_back: ['upperBack', 'rhomboids'],
  lats: ['upperBack'],
  lower_back: ['lowerBack'],
  glutes: ['gluteal'],
  abductors: ['gluteal'],
  hip_flexors: ['hipFlexors'],
  quads: ['quadriceps'],
  adductors: ['adductors'],
  hamstrings: ['hamstring'],
  calves: ['calves', 'tibialis'],
  neck: ['neck'],
};

/** Partes do desenho que um músculo da base acende (cardio e desconhecidos, nenhuma). */
export const slugsOf = (muscle: string | null | undefined): MuscleSlug[] =>
  BY_NAME[(muscle ?? '').toLowerCase()] ?? [];

export type MuscleSet = {
  performed_at: string;
  warmup?: boolean;
  /** Músculo-alvo e sinergistas do exercício ligado */
  target: string | null;
  secondary: string[];
};

/** Séries por parte do desenho desde `from` (inclusive). */
export function muscleWork(sets: MuscleSet[], timeZone: string, from: IsoDate | null) {
  const work: Partial<Record<MuscleSlug, number>> = {};
  const add = (slug: MuscleSlug, v: number) => (work[slug] = (work[slug] ?? 0) + v);
  for (const s of sets) {
    if (s.warmup) continue;
    if (from && todayIn(timeZone, new Date(s.performed_at)) < from) continue;
    const primary = new Set(slugsOf(s.target));
    for (const slug of primary) add(slug, 1);
    const secondary = new Set(s.secondary.flatMap(slugsOf).filter((slug) => !primary.has(slug)));
    for (const slug of secondary) add(slug, 0.5);
  }
  return work;
}

/**
 * Trabalho por parte do desenho de um treino (AC8.6): cada exercício conta as suas séries (as
 * previstas, na montagem; as feitas, no resumo do fim), 1 no alvo e ½ no sinergista.
 */
export function setsWork(entries: { target: string | null; secondary: string[]; sets: number }[]) {
  const work: Partial<Record<MuscleSlug, number>> = {};
  const add = (slug: MuscleSlug, v: number) => (work[slug] = (work[slug] ?? 0) + v);
  for (const e of entries) {
    if (e.sets <= 0) continue;
    const primary = new Set(slugsOf(e.target));
    for (const slug of primary) add(slug, e.sets);
    const secondary = new Set(e.secondary.flatMap(slugsOf).filter((slug) => !primary.has(slug)));
    for (const slug of secondary) add(slug, e.sets / 2);
  }
  return work;
}

/** Nível de 0 a 4 de cada parte, relativo à mais trabalhada (para o BodyMap). */
export function workLevels(work: Partial<Record<MuscleSlug, number>>) {
  const max = Math.max(0, ...Object.values(work).map((v) => v ?? 0));
  const levels: Partial<Record<MuscleSlug, number>> = {};
  for (const [slug, v] of Object.entries(work)) levels[slug as MuscleSlug] = muscleLevel(v, max);
  return levels;
}

/** Os músculos sem nenhuma série no período, na ordem do desenho. */
export const untrained = (work: Partial<Record<MuscleSlug, number>>) =>
  MUSCLE_SLUGS.filter((slug) => !work[slug]);

/** Tom de 0 a 4 pelo trabalho, relativo ao músculo mais trabalhado do período. */
export function muscleLevel(value: number | undefined, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!value || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((value / max) * 4))) as 1 | 2 | 3 | 4;
}

export type WeekSet = {
  performed_at: string;
  warmup?: boolean;
  weight_kg: number | null;
  reps: number | null;
  effort?: number | null;
  effort_scale?: EffortScale | null;
};

/**
 * Volume (carga × reps), séries e esforço médio por semana ISO, da mais velha para a mais nova.
 * Volume subindo com esforço subindo é cansaço acumulando (V6 §7).
 */
export function weeklyVolume(sets: WeekSet[], timeZone: string, scale: EffortScale | null) {
  const weeks = new Map<string, { volumeKg: number; sets: number; effort: number[] }>();
  for (const s of sets) {
    if (s.warmup) continue;
    const week = isoWeekKey(todayIn(timeZone, new Date(s.performed_at)));
    const w = weeks.get(week) ?? { volumeKg: 0, sets: 0, effort: [] };
    w.volumeKg += (s.weight_kg ?? 0) * (s.reps ?? 0);
    w.sets += 1;
    if (scale && s.effort != null && s.effort_scale)
      w.effort.push(convertEffort(s.effort, s.effort_scale, scale));
    weeks.set(week, w);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, w]) => ({
      week,
      volumeKg: Math.round(w.volumeKg * 100) / 100,
      sets: w.sets,
      effort: w.effort.length
        ? Math.round((w.effort.reduce((a, b) => a + b, 0) / w.effort.length) * 10) / 10
        : null,
    }));
}
