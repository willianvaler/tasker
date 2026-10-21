// Busca e filtros da Biblioteca (AC3.5, D235): por texto (nos três idiomas), equipamento, parte do
// corpo e músculo. O vocabulário é o de scripts/exercicios/montar-base.mjs.

import { commonRank, matchScore, normalizeName, type ExerciseLike } from './exercise-match';

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

/**
 * Quanto o exercício responde à busca (0 a 1), enquanto a pessoa ainda digita: "supi" acha o
 * supino, "sup ret" acha o supino reto, "corrente" acha "Supino com corrente". Nome igual vale 1;
 * cada palavra digitada como começo de uma palavra do nome (o nome começando com o texto entra
 * aqui), 0,85; o texto no meio do nome, 0,6. No empate, quem ordena é o `filterExercises`. Sem nada disso, vale o `matchScore` (palavras inteiras e
 * sinônimos de academia: "supino" acha "bench press").
 */
export function searchScore(text: string, exercise: ExerciseLike) {
  const query = normalizeName(text);
  if (!query) return 0;
  const words = query.split(' ');
  let best = 0;
  for (const name of [exercise.name_pt, exercise.name_es, exercise.name_en]) {
    if (!name) continue;
    const full = normalizeName(name);
    if (full === query) return 1;
    const nameWords = full.split(' ');
    if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) best = Math.max(best, 0.85);
    else if (query.length >= 3 && full.includes(query)) best = Math.max(best, 0.6);
  }
  // Achou pelo começo das palavras: fica nessa faixa, e o empate vai para os mais comuns
  return best || matchScore(text, exercise);
}

/** Filtra e ordena: com texto, pelo mais parecido; sem texto, pelo nome. */
export function filterExercises<T extends FilterableExercise>(
  list: T[],
  filter: ExerciseFilter,
  nameOf: (e: T) => string,
) {
  const query = filter.query?.trim() ?? '';
  // `close`: no empate da busca, o nome mais perto do que foi digitado (o mais curto) vem antes
  const out: { exercise: T; score: number; close: number }[] = [];
  for (const e of list) {
    if (filter.equipment?.length && !filter.equipment.includes(e.equipment)) continue;
    if (filter.bodyPart && e.body_part !== filter.bodyPart) continue;
    if (filter.muscle && e.target !== filter.muscle && !e.secondary.includes(filter.muscle))
      continue;
    const score = query ? searchScore(query, e) : 1;
    if (query && score < 0.34) continue;
    out.push({ exercise: e, score, close: query ? matchScore(query, e) : 0 });
  }
  return out
    .sort(
      (a, b) =>
        b.score - a.score ||
        (query ? commonRank(a.exercise.id) - commonRank(b.exercise.id) : 0) ||
        b.close - a.close ||
        (query ? nameOf(a.exercise).length - nameOf(b.exercise).length : 0) ||
        nameOf(a.exercise).localeCompare(nameOf(b.exercise)),
    )
    .map((x) => x.exercise);
}
