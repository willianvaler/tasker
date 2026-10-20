import { parseWeight } from '../workout';
import type { WeightUnit } from './types';

// Unidade de carga (AC4.1, V6 §3): o diário guarda sempre em kg (`workout_sets.weight_kg`); a
// tela converte para a unidade do Perfil. Espelho da conta do `_set_weight_kg` no banco.

export const KG_PER_LB = 0.45359237;

/** Passo do −/+ e do arredondamento: 2,5 kg ou 5 lb. */
export const weightStep = (unit: WeightUnit) => (unit === 'lb' ? 5 : 2.5);

export const toKg = (value: number, unit: WeightUnit) =>
  unit === 'lb' ? value * KG_PER_LB : value;
export const fromKg = (kg: number, unit: WeightUnit) => (unit === 'lb' ? kg / KG_PER_LB : kg);

/** Arredonda ao múltiplo mais próximo do passo (0,5 sobe). Passo ≤ 0 só tira o ruído. */
export function roundToStep(value: number, step: number) {
  if (step <= 0) return Math.round(value * 100) / 100;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/** "40kg", "90 lb" → kg (com duas casas). Sem unidade ou estranho: null. */
export function textToKg(weight: string | null | undefined): number | null {
  const parsed = parseWeight(weight);
  if (!parsed) return null;
  const unit: WeightUnit = parsed.unit.startsWith('lb') ? 'lb' : 'kg';
  return Math.round(toKg(parsed.value, unit) * 100) / 100;
}

/**
 * Carga do diário para a tela: "42,5 kg" (pt/es) ou "42.5 kg" (en). Em lb arredonda a meio
 * quilo de libra, para 20 kg não virar "44,09 lb".
 */
export function formatWeight(kg: number, unit: WeightUnit, locale = 'pt-BR') {
  const value = unit === 'lb' ? Math.round(fromKg(kg, unit) * 2) / 2 : Math.round(kg * 100) / 100;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  return `${text} ${unit}`;
}

/** Volume (carga × reps) de várias séries, em kg; aquecimento não conta. */
export function volumeKg(
  sets: { weight_kg?: number | null; reps?: number | null; warmup?: boolean | null }[],
) {
  return sets.reduce((sum, s) => (s.warmup ? sum : sum + (s.weight_kg ?? 0) * (s.reps ?? 0)), 0);
}
