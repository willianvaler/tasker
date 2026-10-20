import { addDays, startOfIsoWeek, todayIn, type IsoDate } from '../parser/dates';

// Mapa de calor do ano (AC8.1, V6 §7), estilo GitHub: semanas em colunas, dias (segunda a domingo)
// em linhas, tom pelo tempo treinado no dia. O tempo sai do diário: da primeira à última série do
// dia, mais uns minutos da última (funciona sem internet e não depende de sessão no servidor).

export const LAST_SET_MINUTES = 3;

/** Intervalo entre séries que separa dois treinos no mesmo dia (manhã e noite). */
export const SESSION_GAP_MINUTES = 60;

/** Minutos treinados por dia, no fuso da pessoa: cada bloco de séries, da primeira à última. */
export function minutesByDay(
  sets: { performed_at: string }[],
  timeZone: string,
): Record<IsoDate, number> {
  const byDay = new Map<IsoDate, number[]>();
  for (const s of sets) {
    const at = Date.parse(s.performed_at);
    const day = todayIn(timeZone, new Date(at));
    byDay.set(day, [...(byDay.get(day) ?? []), at]);
  }
  const out: Record<IsoDate, number> = {};
  for (const [day, times] of byDay) {
    times.sort((a, b) => a - b);
    let total = 0;
    let first = times[0];
    for (let i = 1; i <= times.length; i++) {
      if (i === times.length || times[i] - times[i - 1] > SESSION_GAP_MINUTES * 60000) {
        total += Math.round((times[i - 1] - first) / 60000) + LAST_SET_MINUTES;
        first = times[i];
      }
    }
    out[day] = total;
  }
  return out;
}

/** 0 sem treino; 1 até 29 min; 2 até 59; 3 até 89; 4 de 90 em diante. */
export function heatLevel(minutes: number | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!minutes || minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 90) return 3;
  return 4;
}

export type HeatCell = { day: IsoDate; minutes: number; level: 0 | 1 | 2 | 3 | 4 } | null;

/**
 * As últimas `weeks` semanas até hoje: cada coluna é uma semana (segunda a domingo); dia depois
 * de hoje vem como null.
 */
export function yearGrid(
  today: IsoDate,
  minutes: Record<IsoDate, number>,
  weeks = 53,
): HeatCell[][] {
  const monday = startOfIsoWeek(today);
  const start = addDays(monday, -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      if (day > today) return null;
      const m = minutes[day] ?? 0;
      return { day, minutes: m, level: heatLevel(m) };
    }),
  );
}

/** Dias com treino, tempo total e média de dias por semana no período (para os números do topo). */
export function trainingTotals(minutes: Record<IsoDate, number>, from: IsoDate, today: IsoDate) {
  const days = Object.entries(minutes).filter(([day]) => day >= from && day <= today);
  const total = days.reduce((s, [, m]) => s + m, 0);
  const spanDays =
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return {
    days: days.length,
    minutes: total,
    perWeek: Math.round((days.length / Math.max(spanDays / 7, 1)) * 10) / 10,
  };
}
