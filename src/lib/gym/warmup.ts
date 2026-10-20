import { roundToStep } from './units';

// Aquecimento sugerido (AC9.2, V6 §8): antes da primeira série pesada, séries mais leves e com
// menos esforço (40 %, 60 %, 80 % da carga de trabalho), arredondadas ao degrau e nunca abaixo
// da barra. Opcionais: no Modo Treino, cada uma é um toque que registra como aquecimento.

export const WARMUP_STEPS = [
  { pct: 40, reps: 8 },
  { pct: 60, reps: 5 },
  { pct: 80, reps: 3 },
] as const;

export type WarmupSet = { weight: number; reps: number; pct: number };

/**
 * Sem carga (peso do corpo) ou carga leve demais para aquecer (até 1,25 × a barra): nada. Duas
 * sugestões com a mesma carga viram uma.
 */
export function suggestWarmup(work: number | null, bar: number, step: number): WarmupSet[] {
  if (work == null || work <= 0 || work <= bar * 1.25) return [];
  const out: WarmupSet[] = [];
  for (const { pct, reps } of WARMUP_STEPS) {
    const weight = Math.max(bar, roundToStep((work * pct) / 100, step));
    if (weight >= work) continue;
    if (out.some((s) => s.weight === weight)) continue;
    out.push({ weight, reps, pct });
  }
  return out;
}
