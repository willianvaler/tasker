import { roundToStep } from './units';
import type { WeightUnit } from './types';

// Progressão automática (AC6, V6 §5): a próxima carga sai do diário, por uma função pura (a mesma
// em todos os aparelhos). Nada de contador guardado: corrigir uma série errada corrige a próxima
// sugestão. Cada prescrição diz por quê (chave de i18n + variáveis).

export type ProgressionRule = 'off' | 'linear' | 'double' | 'greyskull' | 'time';
export const PROGRESSION_RULES: ProgressionRule[] = [
  'off',
  'linear',
  'double',
  'greyskull',
  'time',
];
/** Padrão de quem começa (V6 decisão 3): progressão dupla de 8 a 12 */
export const DEFAULT_RULE: ProgressionRule = 'double';
export const DOUBLE_RANGE = { min: 8, max: 12 };
/** Falhas seguidas até o deload: 3 na linear e na dupla, 1 no Greyskull */
export const FAILS_TO_DELOAD: Record<ProgressionRule, number> = {
  off: Infinity,
  linear: 3,
  double: 3,
  greyskull: 1,
  time: 3,
};
export const DELOAD = 0.1;
export const TIME_STEP_SECONDS = 5;

/** Uma série da sessão: o que foi feito e o que pedia. */
export type LoggedSet = {
  weight: number | null;
  reps: number | null;
  seconds?: number | null;
  targetReps?: number | null;
  targetSeconds?: number | null;
};

/** Uma sessão (um dia) do exercício: as séries que contam, na ordem, e quantas o plano pedia. */
export type Session = { day: string; sets: LoggedSet[]; targetSets: number };

export type Plan = {
  /** Carga do plano, na unidade dele (null: peso do corpo) */
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  seconds?: number | null;
  sets: number;
};

export type Prescription = {
  weight: number | null;
  reps: number | null;
  seconds?: number | null;
  kind: 'off' | 'first' | 'up' | 'hold' | 'deload';
  why: { key: string; vars?: Record<string, string | number> };
};

/** Degrau padrão (V6 §5): 2,5 kg em cima, 5 kg em pernas, costas e quadril; 5/10 lb. */
export function defaultStep(bodyPart: string | null | undefined, unit: WeightUnit) {
  const lower = ['upper legs', 'lower legs', 'legs', 'back', 'glutes', 'hips'].includes(
    (bodyPart ?? '').toLowerCase(),
  );
  if (unit === 'lb') return lower ? 10 : 5;
  return lower ? 5 : 2.5;
}

type Verdict = 'top' | 'ok' | 'fail';

/**
 * Leitura honesta da sessão: série que faltou ou com menos repetições (ou tempo) que o pedido é
 * falha; sessão com falha nunca sobe. "top" é ter feito tudo (na dupla, o topo da faixa).
 */
export function judgeSession(
  rule: ProgressionRule,
  session: Session,
  range = DOUBLE_RANGE,
): Verdict {
  const sets = session.sets;
  if (sets.length < session.targetSets || sets.length === 0) return 'fail';
  if (rule === 'time') {
    return sets.every((s) => (s.seconds ?? 0) >= (s.targetSeconds ?? Infinity)) ? 'top' : 'fail';
  }
  if (rule === 'double') {
    if (sets.some((s) => (s.reps ?? 0) < range.min)) return 'fail';
    return sets.every((s) => (s.reps ?? 0) >= range.max) ? 'top' : 'ok';
  }
  return sets.every((s) => (s.reps ?? 0) >= (s.targetReps ?? Infinity)) ? 'top' : 'fail';
}

const describe = (session: Session) => {
  const reps = session.sets.map((s) => s.reps ?? 0);
  const same = reps.every((r) => r === reps[0]);
  return same ? `${session.sets.length}×${reps[0]}` : reps.join('/');
};

/**
 * Próxima prescrição. `sessions` do mais novo para o mais velho. `step` na unidade do plano.
 * Exercício sem carga (peso do corpo) progride em repetições.
 */
export function prescribe(
  rule: ProgressionRule,
  plan: Plan,
  sessions: Session[],
  step: number,
  range = DOUBLE_RANGE,
): Prescription {
  const keep = { weight: plan.weight, reps: plan.reps, seconds: plan.seconds ?? null };
  if (rule === 'off') return { ...keep, kind: 'off', why: { key: 'progression.off' } };
  const last = sessions[0];
  if (!last) return { ...keep, kind: 'first', why: { key: 'progression.first' } };

  const verdict = judgeSession(rule, last, range);
  const done = describe(last);
  const lastWeight = last.sets.find((s) => s.weight != null)?.weight ?? plan.weight;
  const bodyweight = lastWeight == null;
  const round = (v: number) => roundToStep(v, step);

  if (verdict === 'fail') {
    let fails = 0;
    for (const s of sessions) {
      if (judgeSession(rule, s, range) !== 'fail') break;
      fails++;
    }
    if (fails >= FAILS_TO_DELOAD[rule] && !bodyweight && rule !== 'time') {
      const weight = round((lastWeight as number) * (1 - DELOAD));
      return {
        weight,
        reps: rule === 'double' ? range.min : plan.reps,
        seconds: keep.seconds,
        kind: 'deload',
        why: { key: 'progression.deload', vars: { fails, weight } },
      };
    }
    return {
      weight: lastWeight,
      reps: plan.reps,
      seconds: keep.seconds,
      kind: 'hold',
      why: { key: 'progression.holdFail', vars: { done } },
    };
  }

  if (rule === 'time') {
    const seconds = (plan.seconds ?? last.sets[0]?.targetSeconds ?? 0) + TIME_STEP_SECONDS;
    return {
      weight: plan.weight,
      reps: plan.reps,
      seconds,
      kind: 'up',
      why: { key: 'progression.upTime', vars: { step: TIME_STEP_SECONDS } },
    };
  }

  if (rule === 'double' && verdict === 'ok') {
    // Na faixa: mesma carga, uma repetição a mais que a menor da última
    const reps = Math.min(range.max, Math.min(...last.sets.map((s) => s.reps ?? 0)) + 1);
    return {
      weight: lastWeight,
      reps,
      seconds: keep.seconds,
      kind: 'hold',
      why: { key: 'progression.holdRange', vars: { done, reps } },
    };
  }

  if (bodyweight) {
    const reps = (plan.reps ?? last.sets[0]?.targetReps ?? 0) + 1;
    return {
      weight: null,
      reps,
      seconds: keep.seconds,
      kind: 'up',
      why: { key: 'progression.upReps', vars: { done } },
    };
  }

  if (rule === 'greyskull') {
    // A última série vai até a falha: o dobro da meta dobra o degrau
    const lastSet = last.sets[last.sets.length - 1];
    const target = lastSet.targetReps ?? plan.reps ?? 0;
    const double = target > 0 && (lastSet.reps ?? 0) >= target * 2;
    const add = double ? step * 2 : step;
    return {
      weight: round((lastWeight as number) + add),
      reps: plan.reps,
      seconds: keep.seconds,
      kind: 'up',
      why: { key: double ? 'progression.upDouble' : 'progression.up', vars: { step: add, done } },
    };
  }

  return {
    weight: round((lastWeight as number) + step),
    reps: rule === 'double' ? range.min : plan.reps,
    seconds: keep.seconds,
    kind: 'up',
    why: {
      key: rule === 'double' ? 'progression.upRange' : 'progression.up',
      vars: { step, done, min: range.min },
    },
  };
}
