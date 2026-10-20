// Item de uma página de treino sem ruído (AC2.1, V6 §15.3, D234): o painel mostra o exercício
// (séries × repetições ou tempo, carga, descanso) e a observação; o resto fica em "Mais opções",
// a não ser que o item já use aquilo (senão a pessoa não veria um valor que existe).

export type WorkoutExtra =
  | 'due'
  | 'priority'
  | 'labels'
  | 'visibility'
  | 'assignees'
  | 'subtasks'
  | 'attachments'
  | 'comments'
  | 'dependencies'
  | 'fields'
  | 'approval'
  | 'myDay'
  | 'weight'
  | 'extras'
  | 'page';

type ItemLike = {
  due_date?: string | null;
  priority?: number;
  labels?: string[] | null;
  visibility?: string | null;
  weight?: number | null;
  custom?: unknown;
  approver_id?: string | null;
  approver_role?: string | null;
};

/** O que o item já usa, das coisas que ficam escondidas (contagens vêm de fora). */
export function usedExtras(
  item: ItemLike,
  counts: Partial<
    Record<'assignees' | 'subtasks' | 'attachments' | 'comments' | 'dependencies', number>
  > = {},
): Set<WorkoutExtra> {
  const used = new Set<WorkoutExtra>();
  if (item.due_date) used.add('due');
  if ((item.priority ?? 0) > 0) used.add('priority');
  if (item.labels && item.labels.length > 0) used.add('labels');
  if (item.visibility && item.visibility !== 'private') used.add('visibility');
  if ((item.weight ?? 1) > 1) used.add('weight');
  if (
    item.custom &&
    typeof item.custom === 'object' &&
    Object.values(item.custom).some((v) => v !== null && v !== '')
  )
    used.add('fields');
  if (item.approver_id || item.approver_role) used.add('approval');
  for (const [k, n] of Object.entries(counts)) if ((n ?? 0) > 0) used.add(k as WorkoutExtra);
  return used;
}

/**
 * A seção aparece? Fora de página de treino, sempre (quem decide é o modo do painel). Na página de
 * treino, só com "Mais opções" aberto ou quando o item já usa.
 */
export function showInWorkout(
  extra: WorkoutExtra,
  context: { workout: boolean; more: boolean; used: Set<WorkoutExtra> },
) {
  return !context.workout || context.more || context.used.has(extra);
}
