// Painel da tarefa simples × completo (U2, D158). No simples ficam o título, as notas, a data e a
// repetição, a prioridade, as etiquetas, quem faz, as subtarefas, os anexos, os comentários e a
// página. As seções avançadas só aparecem no completo, ou quando a tarefa já usa (senão a
// pessoa não veria um valor que existe).

export type AdvancedSection =
  'dependencies' | 'fields' | 'approval' | 'myDay' | 'time' | 'repeat' | 'weight' | 'extras';

type TaskLike = {
  custom?: unknown;
  approver_id?: string | null;
  approver_role?: string | null;
  estimate_minutes?: number | null;
  actual_minutes?: number | null;
  repeat_plan?: unknown;
  weight?: number | null;
};

/** Seções avançadas que a tarefa já usa */
export function usedSections(
  task: TaskLike,
  context: { dependencies: number; inMyDay: boolean },
): Set<AdvancedSection> {
  const used = new Set<AdvancedSection>();
  if (context.dependencies > 0) used.add('dependencies');
  if (
    task.custom &&
    typeof task.custom === 'object' &&
    Object.values(task.custom).some((v) => v !== null && v !== '')
  )
    used.add('fields');
  if (task.approver_id || task.approver_role) used.add('approval');
  if (context.inMyDay) used.add('myDay');
  if (task.estimate_minutes || task.actual_minutes) used.add('time');
  if (task.repeat_plan) used.add('repeat');
  if ((task.weight ?? 1) > 1) used.add('weight');
  return used;
}

/** A seção aparece? */
export function showSection(
  mode: 'simple' | 'full',
  used: Set<AdvancedSection>,
  s: AdvancedSection,
) {
  return mode === 'full' || used.has(s);
}
