import { estimate1Rm } from './one-rm';

// Recordes pessoais (AC5.2, V6 §4): que recordes uma série nova bate, comparando com o diário do
// mesmo exercício. Espelho do `_set_records` no banco (os mesmos casos nos dois testes):
// - sem série anterior, nada (a primeira não é recorde, é o ponto de partida);
// - aquecimento nunca é recorde nem conta como anterior;
// - weight: maior carga já feita (com pelo menos 1 repetição);
// - reps: mais repetições numa carga que já tinha sido feita (ou sem carga, no peso do corpo);
// - one_rm: maior 1RM estimado (Epley, até 12 repetições);
// - volume: o volume do dia (carga × reps) passa do melhor dia anterior, só na série que passa;
// - duration / distance: mais tempo segurado, mais distância.

export type RecordKind = 'weight' | 'reps' | 'one_rm' | 'volume' | 'duration' | 'distance';

export type RecordSet = {
  weight_kg: number | null;
  reps: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  warmup?: boolean | null;
  /** 'YYYY-MM-DD' no fuso da pessoa (para o volume do dia) */
  day: string;
};

const vol = (s: RecordSet) => (s.weight_kg ?? 0) * (s.reps ?? 0);
const max = (values: (number | null | undefined)[]) =>
  values.reduce<number | null>((m, v) => (v != null && (m == null || v > m) ? v : m), null);

export function setRecords(previous: RecordSet[], next: RecordSet): RecordKind[] {
  if (next.warmup) return [];
  const prev = previous.filter((s) => !s.warmup);
  if (!prev.length) return [];
  const out: RecordKind[] = [];

  const reps = next.reps ?? 0;
  const bestWeight = max(prev.filter((s) => (s.reps ?? 0) >= 1).map((s) => s.weight_kg));
  if (next.weight_kg != null && reps >= 1 && bestWeight != null && next.weight_kg > bestWeight)
    out.push('weight');

  if (reps >= 1) {
    const sameLoad = prev.filter((s) =>
      next.weight_kg == null ? s.weight_kg == null : s.weight_kg === next.weight_kg,
    );
    const bestReps = max(sameLoad.map((s) => s.reps));
    if (bestReps != null && reps > bestReps) out.push('reps');
  }

  const oneRm = estimate1Rm(next.weight_kg, next.reps);
  const best1 = max(prev.map((s) => estimate1Rm(s.weight_kg, s.reps)));
  if (oneRm != null && best1 != null && oneRm > best1) out.push('one_rm');

  if (vol(next) > 0) {
    const byDay = new Map<string, number>();
    for (const s of prev) byDay.set(s.day, (byDay.get(s.day) ?? 0) + vol(s));
    const today = byDay.get(next.day) ?? 0;
    byDay.delete(next.day);
    const bestDay = max([...byDay.values()]);
    if (bestDay != null && bestDay > 0 && today <= bestDay && today + vol(next) > bestDay)
      out.push('volume');
  }

  const bestDuration = max(prev.map((s) => s.duration_seconds));
  if (next.duration_seconds != null && bestDuration != null && next.duration_seconds > bestDuration)
    out.push('duration');
  const bestDistance = max(prev.map((s) => s.distance_m));
  if (next.distance_m != null && bestDistance != null && next.distance_m > bestDistance)
    out.push('distance');

  return out;
}
