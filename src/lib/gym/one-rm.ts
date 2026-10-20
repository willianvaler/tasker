// 1RM estimado (AC5.1, V6 §4): fórmula de Epley, só até 12 repetições (acima disso a estimativa
// não vale). Uma repetição é a própria carga. Espelho do `_e1rm` no banco.

export const MAX_REPS_FOR_1RM = 12;

type SetLike = {
  weight_kg: number | null;
  reps: number | null;
  warmup?: boolean | null;
};

/** 1RM estimado de uma série (kg), ou null se ela não serve para estimar. */
export function estimate1Rm(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps < 1 || reps > MAX_REPS_FOR_1RM)
    return null;
  const value = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return Math.round(value * 100) / 100;
}

/** A série que dá o maior 1RM (sem aquecimento), com o valor; diz qual série foi usada. */
export function best1Rm<T extends SetLike>(sets: T[]): { set: T; oneRm: number } | null {
  let best: { set: T; oneRm: number } | null = null;
  for (const set of sets) {
    if (set.warmup) continue;
    const oneRm = estimate1Rm(set.weight_kg, set.reps);
    if (oneRm != null && (!best || oneRm > best.oneRm)) best = { set, oneRm };
  }
  return best;
}

/** Carga para fazer `reps` repetições a partir do 1RM (o inverso de Epley). */
export function weightForReps(oneRmKg: number, reps: number) {
  if (reps <= 1) return oneRmKg;
  return Math.round((oneRmKg / (1 + reps / 30)) * 100) / 100;
}

/** Tabela de porcentagens do 1RM (100% a 50%, de 5 em 5), arredondada ao passo da anilha. */
export function percentTable(oneRmKg: number, step = 2.5) {
  const out: { pct: number; kg: number }[] = [];
  for (let pct = 100; pct >= 50; pct -= 5) {
    const raw = (oneRmKg * pct) / 100;
    out.push({ pct, kg: step > 0 ? Math.round(raw / step) * step : Math.round(raw * 100) / 100 });
  }
  return out;
}
