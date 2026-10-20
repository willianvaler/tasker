// Busca e filtros da Biblioteca (AC3.5, D235): por texto (nos três idiomas), equipamento, parte do
// corpo e músculo. O vocabulário é o de scripts/exercicios/montar-base.mjs.

import { commonRank, matchScore, type ExerciseLike } from './exercise-match';

export const EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'ez_bar',
  'kettlebell',
  'cable',
  'machine',
  'smith',
  'band',
  'ball',
  'medicine_ball',
  'foam_roller',
  'cardio_machine',
  'other',
] as const;
export const BODY_PARTS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'cardio',
  'neck',
  'other',
] as const;
export const MUSCLES = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'serratus',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'adductors',
  'abductors',
  'hip_flexors',
  'neck',
  'cardio',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];
export type BodyPart = (typeof BODY_PARTS)[number];
export type Muscle = (typeof MUSCLES)[number];

export type FilterableExercise = ExerciseLike & {
  body_part: string;
  target: string | null;
  secondary: string[];
  equipment: string;
};

export type ExerciseFilter = {
  query?: string;
  /** Só o que a pessoa tem (vazio = qualquer) */
  equipment?: string[];
  bodyPart?: string | null;
  muscle?: string | null;
};

/** Filtra e ordena: com texto, pelo mais parecido; sem texto, pelo nome. */
export function filterExercises<T extends FilterableExercise>(
  list: T[],
  filter: ExerciseFilter,
  nameOf: (e: T) => string,
) {
  const query = filter.query?.trim() ?? '';
  const out: { exercise: T; score: number }[] = [];
  for (const e of list) {
    if (filter.equipment?.length && !filter.equipment.includes(e.equipment)) continue;
    if (filter.bodyPart && e.body_part !== filter.bodyPart) continue;
    if (filter.muscle && e.target !== filter.muscle && !e.secondary.includes(filter.muscle))
      continue;
    const score = query ? matchScore(query, e) : 1;
    if (query && score < 0.34) continue;
    out.push({ exercise: e, score });
  }
  return out
    .sort(
      (a, b) =>
        b.score - a.score ||
        (query ? commonRank(a.exercise.id) - commonRank(b.exercise.id) : 0) ||
        nameOf(a.exercise).localeCompare(nameOf(b.exercise)),
    )
    .map((x) => x.exercise);
}
