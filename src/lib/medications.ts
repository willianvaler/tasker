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
  /** Horários das doses ('HH:MM', em ordem); vazio = sem lembrete (SA3) */
  dose_times: string[];
  /** Dias da semana (0 = domingo); vazio = a cada `every_days` */
  weekdays: number[];
  /** Mostrar o nome no aviso (V15-7: desligado por padrão) */
  show_name: boolean;
};

/** Dose do histórico (SA3, D385): Tomei, Pular ou Adiar uma dose de um dia. */
export type Intake = {
  id: string;
  medication_id: string;
  day: IsoDate;
  /** 'HH:MM' */
  slot: string;
  status: 'taken' | 'skipped' | 'snoozed';
  snoozes: number;
  snoozed_until: string | null;
  acted_at: string;
};

/** Até quantas vezes adiar a mesma dose, e quantos minutos cada vez. */
export const SNOOZE_MAX = 3;
export const SNOOZE_MINUTES = 15;

/** Faltando até tantos dias, o remédio aparece como "comprar logo". */
export const LOW_DAYS = 7;

/** Dia de dose: os dias da semana marcados ou, sem eles, a cada `every_days` desde a contagem.
 * Espelho de `public._medication_dose_day`. */
export function isDoseDay(
  m: Pick<Medication, 'weekdays' | 'every_days' | 'stock_on'>,
  day: IsoDate,
): boolean {
  if (m.weekdays.length > 0) return m.weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay());
  const every = Math.max(1, m.every_days);
  return ((daysBetween(m.stock_on, day) % every) + every) % every === 0;
}

/** Dias de dose em (from, to]: a partir do dia seguinte a `from`, até `to`. */
function doseDaysIn(
  m: Pick<Medication, 'weekdays' | 'every_days' | 'stock_on'>,
  from: IsoDate,
  to: IsoDate,
) {
  const span = daysBetween(from, to);
  if (span <= 0) return 0;
  if (m.weekdays.length === 0) return Math.floor(span / Math.max(1, m.every_days));
  let count = 0;
  for (let i = 1; i <= span; i++) if (isDoseDay(m, addDays(from, i))) count++;
  return count;
}

/** O dia da n-ésima dose depois de `from` (n ≥ 1). */
function nthDoseDay(
  m: Pick<Medication, 'weekdays' | 'every_days' | 'stock_on'>,
  from: IsoDate,
  n: number,
) {
  if (m.weekdays.length === 0) return addDays(from, n * Math.max(1, m.every_days));
  let day = from;
  for (let found = 0; found < n;) {
    day = addDays(day, 1);
    if (isDoseDay(m, day)) found++;
  }
  return day;
}

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
  m: Pick<
    Medication,
    'dose' | 'times_per_day' | 'every_days' | 'stock' | 'stock_on' | 'paused' | 'weekdays'
  >,
  today: IsoDate,
): MedicationBalance {
  const perDoseDay = m.dose * m.times_per_day;
  if (m.paused || perDoseDay <= 0) {
    return { left: m.stock, perDoseDay, lastDay: null, daysLeft: null, state: 'paused' };
  }
  const doseDays = doseDaysIn(m, m.stock_on, today);
  const left = round(Math.max(0, m.stock - doseDays * perDoseDay));
  // Dias de dose que a contagem cobre, desde o dia seguinte a ela (limitado a uns 10 anos)
  const covered = Math.min(3650, Math.floor(m.stock / perDoseDay + 1e-9));
  const lastDay = covered > 0 ? nthDoseDay(m, m.stock_on, covered) : m.stock_on;
  const daysLeft = Math.max(0, daysBetween(today, lastDay));
  // No último dia ainda há a dose dele ("acaba hoje"); depois dele, acabou
  const state = covered === 0 || today > lastDay ? 'out' : daysLeft <= LOW_DAYS ? 'low' : 'ok';
  return { left, perDoseDay, lastDay, daysLeft, state };
}

/** Comprimidos por mês (30 dias), para o resumo e o "quantas caixas". */
export function monthlyUse(
  m: Pick<Medication, 'dose' | 'times_per_day' | 'every_days'> & { weekdays?: number[] },
) {
  const perWeekFraction = m.weekdays?.length
    ? m.weekdays.length / 7
    : 1 / Math.max(1, m.every_days);
  return round(m.dose * m.times_per_day * 30 * perWeekFraction);
}

/** "8, 20:30; 13h" → ['08:00', '13:00', '20:30'] (sem repetir, em ordem); vazio → []; inválido → null. */
export function parseDoseTimes(text: string): string[] | null {
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  const out = new Set<string>();
  for (const part of parts) {
    const m = /^(\d{1,2})(?:[:hH](\d{2})?)?$/.exec(part);
    if (!m) return null;
    const h = Number(m[1]);
    const min = m[2] === undefined ? 0 : Number(m[2]);
    if (h > 23 || min > 59) return null;
    out.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  if (out.size > 12) return null;
  return [...out].sort();
}

/** 'HH:MM:SS' ou 'HH:MM' → 'HH:MM'. */
export const slotText = (time: string) => time.slice(0, 5);

/**
 * Id da dose a partir do remédio, do dia e do horário: dois aparelhos sem conexão gravam a mesma
 * linha e a dose não se repete. Quatro FNV-1a de 32 bits, no formato de um UUID.
 */
export function intakeId(medicationId: string, day: IsoDate, slot: string): string {
  const key = `${medicationId}|${day}|${slotText(slot)}`;
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
    .map((seed) => {
      let h = seed >>> 0;
      for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    })
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type DoseState = 'taken' | 'skipped' | 'snoozed' | 'due' | 'later';

export type Dose = {
  medication: Medication;
  slot: string;
  intake: Intake | null;
  state: DoseState;
};

/**
 * As doses de hoje, por horário: o que já foi tomado ou pulado, o adiado, o que já está na hora
 * (`due`) e o que vem depois. `nowMinutes` é a hora de agora no fuso do perfil.
 */
export function dosesOfDay(
  meds: Medication[],
  intakes: Intake[],
  day: IsoDate,
  nowMinutes: number,
): Dose[] {
  const byKey = new Map(intakes.map((i) => [`${i.medication_id}|${i.day}|${slotText(i.slot)}`, i]));
  const doses: Dose[] = [];
  for (const medication of meds) {
    if (medication.paused || !isDoseDay(medication, day)) continue;
    for (const raw of medication.dose_times) {
      const slot = slotText(raw);
      const intake = byKey.get(`${medication.id}|${day}|${slot}`) ?? null;
      const [h, m] = slot.split(':').map(Number);
      const state: DoseState = intake ? intake.status : h * 60 + m <= nowMinutes ? 'due' : 'later';
      doses.push({ medication, slot, intake, state });
    }
  }
  return doses.sort(
    (a, b) => a.slot.localeCompare(b.slot) || a.medication.name.localeCompare(b.medication.name),
  );
}

/** Tomei, Pular ou Adiar uma dose: a linha nova do histórico (null se não pode mais adiar). */
export function intakeFor(
  medicationId: string,
  day: IsoDate,
  slot: string,
  action: 'taken' | 'skipped' | 'snoozed',
  previous: Pick<Intake, 'snoozes'> | null,
  now: Date,
): Intake | null {
  const snoozes = previous?.snoozes ?? 0;
  if (action === 'snoozed' && snoozes >= SNOOZE_MAX) return null;
  return {
    id: intakeId(medicationId, day, slot),
    medication_id: medicationId,
    day,
    slot: slotText(slot),
    status: action,
    snoozes: action === 'snoozed' ? snoozes + 1 : snoozes,
    snoozed_until:
      action === 'snoozed' ? new Date(now.getTime() + SNOOZE_MINUTES * 60_000).toISOString() : null,
    acted_at: now.toISOString(),
  };
}

/** Tomadas e doses esperadas nos últimos `days` dias até ontem (hoje ainda está correndo). */
export function adherence(m: Medication, intakes: Intake[], today: IsoDate, days = 7) {
  let expected = 0;
  let taken = 0;
  for (let i = 1; i <= days; i++) {
    const day = addDays(today, -i);
    if (!isDoseDay(m, day)) continue;
    expected += m.dose_times.length;
  }
  for (const it of intakes) {
    if (
      it.medication_id === m.id &&
      it.status === 'taken' &&
      it.day < today &&
      it.day >= addDays(today, -days)
    )
      taken++;
  }
  return { taken: Math.min(taken, expected), expected };
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
