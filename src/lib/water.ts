import { addDays } from './parser/dates';

/**
 * Água (SA2, D383): registros em mL com o dia no fuso da pessoa. Contas puras para a tela: o total
 * do dia, a semana e quanto falta para a meta.
 */
export type WaterLog = { id: string; ml: number; day: string; logged_at: string };

export const WATER_DEFAULTS = { goal: 2000, cup: 250 } as const;
export const WATER_LIMITS = { goal: [250, 10000], cup: [50, 2000], entry: [1, 5000] } as const;

export function dayTotal(logs: readonly WaterLog[], day: string): number {
  return logs.reduce((sum, l) => (l.day === day ? sum + l.ml : sum), 0);
}

/** Os últimos 7 dias até hoje (o mais antigo primeiro), com o total de cada um. */
export function waterWeek(logs: readonly WaterLog[], today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, ml: dayTotal(logs, day) };
  });
}

/** Média por dia dos dias com registro na semana (0 se nenhum). */
export function weekAverage(week: readonly { ml: number }[]): number {
  const days = week.filter((d) => d.ml > 0);
  return days.length ? Math.round(days.reduce((s, d) => s + d.ml, 0) / days.length) : 0;
}

/** Fração da meta (0 a 1; passa de 1 quando bebeu mais). */
export function goalProgress(total: number, goal: number): number {
  return goal > 0 ? total / goal : 0;
}

/**
 * Quantidade digitada: "300", "300 ml", "0,5 l", "1.5L". Fora dos limites de um registro, null.
 */
export function parseWaterAmount(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(ml|l)?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const ml = Math.round(m[2]?.toLowerCase() === 'l' ? n * 1000 : n);
  const [min, max] = WATER_LIMITS.entry;
  return ml >= min && ml <= max ? ml : null;
}

/** Litros com uma casa ("1,5 L") ou mL abaixo de 1 L, no idioma dado. */
export function formatWater(ml: number, locale: string): string {
  if (ml < 1000) return `${ml} mL`;
  return `${(ml / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} L`;
}
