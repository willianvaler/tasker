// Próxima ação (M4, D141): o que fazer agora, entre o que está aberto e não espera ninguém.
// Ordem: o que já está em andamento; o "Meu dia", na ordem escolhida; atrasadas; de hoje; e,
// dentro de cada grupo, prioridade maior e data mais antiga. Puro.

export type Candidate = {
  id: string;
  status: string;
  priority: number;
  due_date: string | null;
  blocked?: boolean;
};

export function nextAction<T extends Candidate>(
  tasks: readonly T[],
  myDay: readonly string[],
  today: string,
): T | null {
  const open = tasks.filter((t) => t.status !== 'done' && !t.blocked);
  const group = (t: T) => {
    if (t.status === 'doing') return 0;
    if (myDay.includes(t.id)) return 1;
    if (t.due_date && t.due_date < today) return 2;
    if (t.due_date === today) return 3;
    return 4;
  };
  const sorted = [...open].sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 1 ? myDay.indexOf(a.id) - myDay.indexOf(b.id) : 0) ||
      b.priority - a.priority ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
  );
  // Sem data e fora do Meu dia não é sugestão
  const best = sorted[0];
  return best && group(best) < 4 ? best : null;
}

/** Minutos estimados do Meu dia que ainda faltam. */
export function remainingEstimate(
  tasks: readonly { status: string; estimate_minutes: number | null }[],
) {
  return tasks.reduce((sum, t) => sum + (t.status === 'done' ? 0 : (t.estimate_minutes ?? 0)), 0);
}
