import { addDays, addMonths, type IsoDate } from './parser/dates';

// Equipamentos e manutenção (CS1, D365). A próxima data é do servidor (`maintenance_next`, gravada em
// `maintenance_plans.next_on`); este espelho serve para mostrar antes de sincronizar (plano criado
// sem conexão) e tem os mesmos casos do pgTAP. Mudou a conta? Mude os dois.

export type MaintenanceUnit = 'dias' | 'meses';

export type Equipment = {
  id: string;
  name: string;
  room: string | null;
  brand: string | null;
  model: string | null;
  purchased_on: string | null;
  device_id: string | null;
  notes: string | null;
};

export type MaintenancePlan = {
  id: string;
  equipment_id: string;
  name: string;
  every_n: number;
  unit: MaintenanceUnit;
  last_done_on: string | null;
  page_id: string | null;
  paused: boolean;
  next_on: string | null;
  task_id: string | null;
};

/** Último feito + intervalo; sem último feito, hoje (o fim do mês se ajusta: 31/01 + 1 mês = 28/02). */
export function nextMaintenance(
  last: IsoDate | null,
  every: number,
  unit: MaintenanceUnit,
  today: IsoDate,
): IsoDate {
  if (!last) return today;
  return unit === 'dias' ? addDays(last, every) : addMonths(last, every);
}

/** A próxima data que a tela mostra: a do servidor, ou a conta local enquanto não sincronizou. */
export function planNext(p: MaintenancePlan, today: IsoDate): IsoDate {
  return p.next_on ?? nextMaintenance(p.last_done_on, p.every_n, p.unit, today);
}

export type PlanStatus = 'paused' | 'late' | 'today' | 'soon' | 'ok';

/** Atrasado, hoje, nos próximos 7 dias ou tranquilo. */
export function planStatus(p: MaintenancePlan, today: IsoDate): PlanStatus {
  if (p.paused) return 'paused';
  const next = planNext(p, today);
  if (next < today) return 'late';
  if (next === today) return 'today';
  return next <= addDays(today, 7) ? 'soon' : 'ok';
}

const ORDER: Record<PlanStatus, number> = { late: 0, today: 1, soon: 2, ok: 3, paused: 4 };

/** Os planos na ordem do que pede atenção primeiro, e depois pela data. */
export function sortPlans(plans: MaintenancePlan[], today: IsoDate): MaintenancePlan[] {
  return [...plans].sort(
    (a, b) =>
      ORDER[planStatus(a, today)] - ORDER[planStatus(b, today)] ||
      planNext(a, today).localeCompare(planNext(b, today)),
  );
}

/**
 * Data digitada no formulário: `25/11`, `25/11/2026`, `2026-11-25` ou "hoje" (pt, en, es). Só datas
 * até hoje (é o "último feito" ou a compra): `25/12` em novembro é o do ano passado. Vazio ou
 * inválido → null.
 */
export function parsePastDay(text: string, today: IsoDate): IsoDate | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  if (['hoje', 'today', 'hoy'].includes(s)) return today;
  const valid = (y: number, m: number, d: number): IsoDate | null => {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const back = new Date(`${iso}T00:00:00Z`);
    return back.getUTCMonth() + 1 === m && back.getUTCDate() === d ? iso : null;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const iso = valid(+m[1], +m[2], +m[3]);
    return iso && iso <= today ? iso : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(s);
  if (!m) return null;
  const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4);
  let iso = valid(year, +m[2], +m[1]);
  if (iso && !m[3] && iso > today) iso = valid(year - 1, +m[2], +m[1]);
  return iso && iso <= today ? iso : null;
}

/** O inverso do parsePastDay para preencher o campo ao editar: `2026-09-01` → `01/09/2026`. */
export const formatDayInput = (iso: IsoDate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
