import { localParts } from './booking';
import type { IsoDate } from './parser/dates';

// Enquete de horário (AG4, ESCOPO_V12 §2, D319): a dona propõe de 2 a 5 horários, quem tem o link
// marca os que servem e a dona fecha num. Funções puras: ler o horário digitado, levar a hora local
// do fuso da dona a um instante e ordenar os horários pelos votos. Quem grava é o servidor
// (`save_time_poll`, `time_poll_vote`, `close_time_poll`).

export const POLL_MIN_SLOTS = 2;
export const POLL_MAX_SLOTS = 5;

export type PollSlot = { id: string; starts_at: string; names: string[] };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A hora `HH:MM` do dia `date` no fuso `timeZone` → o instante (ISO, UTC). Acha a diferença do fuso
 * naquele momento (com horário de verão) e confere uma segunda vez perto da troca.
 */
export function localToInstant(date: IsoDate, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const p = localParts(new Date(ms).toISOString(), timeZone);
    const [py, pmo, pd] = p.date.split('-').map(Number);
    const [ph, pmi] = p.time.split(':').map(Number);
    return Date.UTC(py, pmo - 1, pd, ph, pmi) - ms;
  };
  let guess = wanted - offsetAt(wanted);
  guess = wanted - offsetAt(guess);
  return new Date(guess).toISOString();
}

/**
 * Texto do horário → dia e hora: "25/11 14:00", "25/11/2026 9h", "2026-11-25 14h30", "25/11 às 9".
 * Sem ano, a próxima vez que a data chega (a partir de hoje). null = não entendi.
 */
export function parseSlotText(
  text: string,
  today: IsoDate,
): { date: IsoDate; time: string } | null {
  const s = text.trim().toLowerCase();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(s);
  const m = iso ?? br;
  if (!m) return null;
  let y: number;
  let mo: number;
  let d: number;
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else {
    d = Number(br![1]);
    mo = Number(br![2]);
    const [ty] = today.split('-').map(Number);
    y = br![3] ? Number(br![3].length === 2 ? `20${br![3]}` : br![3]) : ty;
    if (!br![3] && `${y}-${pad(mo)}-${pad(d)}` < today) y += 1;
  }
  const rest = s.slice(m[0].length).replace(/^\s*(?:às|as|a las|at|,)?\s*/, '');
  const t = /^(\d{1,2})(?:[:h](\d{2})?)?\s*h?$/.exec(rest);
  if (!t) return null;
  const hh = Number(t[1]);
  const mm = t[2] ? Number(t[2]) : 0;
  if (hh > 23 || mm > 59) return null;
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  const check = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) return null;
  return { date, time: `${pad(hh)}:${pad(mm)}` };
}

/** Os horários com mais gente (empate: todos); nenhum voto, nenhum. */
export function bestSlots(slots: readonly PollSlot[]): string[] {
  const max = Math.max(0, ...slots.map((s) => s.names.length));
  return max ? slots.filter((s) => s.names.length === max).map((s) => s.id) : [];
}

/** Junta um horário novo à proposta: sem repetir, em ordem, no máximo 5. */
export function addSlot(list: readonly string[], iso: string): string[] {
  const at = Date.parse(iso);
  if (list.some((x) => Date.parse(x) === at)) return [...list];
  return [...list, iso].sort((a, b) => Date.parse(a) - Date.parse(b)).slice(0, POLL_MAX_SLOTS);
}
