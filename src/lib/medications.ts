import { daysBetween } from '@/lib/milestones';
import { addDays, type IsoDate } from '@/lib/parser/dates';

// Remédios do Bem-estar (BE4, D270): o saldo é uma conta a partir da última contagem. `stock` é
// quanto havia no dia `stock_on`; as doses contam a partir do dia seguinte, uma vez a cada
// `every_days` dias, `times_per_day` vezes de `dose` comprimidos. Comprar ou contar de novo grava
// uma contagem nova (hoje), então a estimativa nunca acumula erro por muito tempo.

export type Medication = {
  id: string;
  name: string;
  dose: number;
  times_per_day: number;
  every_days: number;
  pack_size: number | null;
  stock: number;
  stock_on: IsoDate;
  paused: boolean;
  notes: string | null;
};

/** Faltando até tantos dias, o remédio aparece como "comprar logo". */
export const LOW_DAYS = 7;

export type MedicationBalance = {
  /** Comprimidos que devem restar hoje (nunca negativo) */
  left: number;
  /** Comprimidos por dia de dose */
  perDoseDay: number;
  /** Último dia com remédio (null se parado ou sem gasto) */
  lastDay: IsoDate | null;
  /** Dias de hoje até o último dia (0 = acaba hoje) */
  daysLeft: number | null;
  state: 'ok' | 'low' | 'out' | 'paused';
};

export function medicationBalance(
  m: Pick<Medication, 'dose' | 'times_per_day' | 'every_days' | 'stock' | 'stock_on' | 'paused'>,
  today: IsoDate,
): MedicationBalance {
  const perDoseDay = m.dose * m.times_per_day;
  const every = Math.max(1, m.every_days);
  if (m.paused || perDoseDay <= 0) {
    return { left: m.stock, perDoseDay, lastDay: null, daysLeft: null, state: 'paused' };
  }
  const doseDays = Math.floor(Math.max(0, daysBetween(m.stock_on, today)) / every);
  const left = round(Math.max(0, m.stock - doseDays * perDoseDay));
  // Dias de dose que a contagem cobre, desde o dia seguinte a ela
  const covered = Math.floor(m.stock / perDoseDay + 1e-9);
  const lastDay = covered > 0 ? addDays(m.stock_on, covered * every) : m.stock_on;
  const daysLeft = Math.max(0, daysBetween(today, lastDay));
  // No último dia ainda há a dose dele ("acaba hoje"); depois dele, acabou
  const state = covered === 0 || today > lastDay ? 'out' : daysLeft <= LOW_DAYS ? 'low' : 'ok';
  return { left, perDoseDay, lastDay, daysLeft, state };
}

/** Comprimidos por mês (30 dias), para o resumo e o "quantas caixas". */
export function monthlyUse(m: Pick<Medication, 'dose' | 'times_per_day' | 'every_days'>) {
  return round((m.dose * m.times_per_day * 30) / Math.max(1, m.every_days));
}

/** Quantidade com vírgula ou ponto e meio comprimido ("1/2", "½"); null se não for número. */
export function parsePills(text: string): number | null {
  const clean = text.trim().replace(/\s+/g, '');
  if (clean === '½' || clean === '1/2') return 0.5;
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
