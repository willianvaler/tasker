import { z } from 'zod';

// Tarefa com repetições (V3 §4.1, D123). O plano fica na tarefa (`repeat_plan`); a conta, em
// `task_progress`, de cada pessoa. Espelho das regras do `log_rep` no banco.

export const REPEAT_MODES = ['sets', 'count', 'interval', 'timed'] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];

export const MAX_REPEATS = 99;
/** Descanso padrão entre séries quando o plano nasce do atalho "3x12" */
export const DEFAULT_REST_SECONDS = 60;

const seconds = (max: number) => z.number().int().min(0).max(max).nullish();

export const repeatPlanSchema = z.object({
  mode: z.enum(REPEAT_MODES),
  total: z.number().int().min(1).max(MAX_REPEATS),
  rest_seconds: seconds(3600),
  rest_after_seconds: seconds(3600),
  duration_seconds: z.number().int().min(1).max(3600).nullish(),
  interval_minutes: z.number().int().min(1).max(1440).nullish(),
});
export type RepeatPlan = z.infer<typeof repeatPlanSchema>;

/** Plano lido do banco (jsonb); formato estranho vira "sem plano". */
export function readRepeatPlan(value: unknown): RepeatPlan | null {
  return repeatPlanSchema.safeParse(value).data ?? null;
}

/**
 * Séries que contam agora: concluída mostra o total; aberta, no máximo total − 1 (quem desmarca
 * pela caixinha volta à conta de antes).
 */
export function effectiveReps(plan: RepeatPlan, done: boolean, stored: number | null | undefined) {
  if (done) return plan.total;
  return Math.max(0, Math.min(stored ?? 0, plan.total - 1));
}

/** Próximo estado depois de +1 ou −1 (o que o aparelho mostra antes da resposta do servidor). */
export function applyRep(
  plan: RepeatPlan,
  done: boolean,
  stored: number | null | undefined,
  delta: 1 | -1,
): { reps: number; done: boolean } {
  const current = effectiveReps(plan, done, stored);
  if (delta === 1) {
    if (done) return { reps: plan.total, done: true };
    const reps = current + 1;
    return { reps, done: reps >= plan.total };
  }
  if (done) return { reps: plan.total - 1, done: false };
  return { reps: Math.max(0, current - 1), done: false };
}

/** "2/4" */
export const repsLabel = (plan: RepeatPlan, reps: number) => `${reps}/${plan.total}`;
