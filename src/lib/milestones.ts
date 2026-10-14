/** Dias de `from` até `to` (datas "YYYY-MM-DD", sem hora). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type MilestoneState =
  | { kind: 'done' }
  | { kind: 'undated' }
  | { kind: 'late'; days: number }
  | { kind: 'today' }
  | { kind: 'soon'; days: number }
  | { kind: 'later'; days: number };

/** Estado do marco em relação a hoje ("YYYY-MM-DD" no fuso do perfil). Até 7 dias é "em breve". */
export function milestoneState(
  milestone: { due_date: string | null; done_at: string | null },
  today: string,
): MilestoneState {
  if (milestone.done_at) return { kind: 'done' };
  if (!milestone.due_date) return { kind: 'undated' };
  const days = daysBetween(today, milestone.due_date);
  if (days < 0) return { kind: 'late', days: -days };
  if (days === 0) return { kind: 'today' };
  return days <= 7 ? { kind: 'soon', days } : { kind: 'later', days };
}

/** O próximo marco aberto: o atrasado mais antigo ou o mais próximo. */
export function nextMilestone<T extends { due_date: string | null; done_at: string | null }>(
  list: readonly T[],
) {
  return list
    .filter((m) => !m.done_at && m.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0];
}
