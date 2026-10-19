// Força do hábito bom/ruim (HB2, ESCOPO_V8 §1; regra do Habitica em docs/HABITICA.md §1).
// Espelho de public._habit_step / public.habit_value_now: mudou aqui, mude lá, com os mesmos casos.

export const HABIT_VALUE_MIN = -47.27;
export const HABIT_VALUE_MAX = 21.27;
const BASE = 0.9747;

export type HabitSides = 'both' | 'up' | 'down';

const clamp = (v: number) => Math.min(HABIT_VALUE_MAX, Math.max(HABIT_VALUE_MIN, v));
const round4 = (v: number) => Math.round(v * 10000) / 10000 + 0; // + 0: nada de −0

/**
 * Um toque: o + soma `0,9747^v` (rende mais quando o hábito anda fraco); o − é o inverso exato do +
 * (acha w com w + 0,9747^w = v), então desfazer um toque é dar o toque contrário.
 */
export function habitStep(value: number, delta: 1 | -1): number {
  const v = clamp(value);
  if (delta === 1) return round4(clamp(v + BASE ** v));
  // Newton em f(w) = w + BASE^w − v; começa um passo abaixo
  let w = v - BASE ** v;
  for (let i = 0; i < 20; i++) {
    const f = w + BASE ** w - v;
    if (Math.abs(f) < 1e-9) break;
    w -= f / (1 + BASE ** w * Math.log(BASE));
  }
  return round4(clamp(w));
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD'. */
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Valor de hoje. Hábito de um lado só (só bom ou só ruim) perde metade da força por dia sem uso,
 * para não ficar "forte" para sempre; abaixo de 0,1 zera. O de dois lados não decai.
 */
export function habitValueNow(
  value: number,
  sides: HabitSides,
  since: string | null,
  today: string,
): number {
  if (sides === 'both' || !since) return value;
  const days = Math.max(0, daysBetween(since, today));
  if (days === 0) return value;
  const v = value / 2 ** days;
  return Math.abs(v) < 0.1 ? 0 : round4(v);
}

export type HabitStrength = 'worst' | 'bad' | 'weak' | 'neutral' | 'good' | 'strong' | 'best';

/** Faixa de cor pelo valor (as do Habitica: vermelho escuro → azul). */
export function habitStrength(value: number): HabitStrength {
  if (value < -20) return 'worst';
  if (value < -10) return 'bad';
  if (value < -1) return 'weak';
  if (value <= 1) return 'neutral';
  if (value <= 5) return 'good';
  if (value <= 10) return 'strong';
  return 'best';
}
