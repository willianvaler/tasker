// Painel da tarefa por uso (UX11, D265; antes Simples × Completo, U2/D158). Uma seção aparece
// porque a tarefa já usa (para nenhum valor ficar escondido), porque a pessoa a adicionou pelo
// "+ Adicionar" ou porque ligou "Mostrar todas as seções" (Configurações → Aparência). Título,
// vencimento, prioridade, etiquetas, descrição, subtarefas e o que é do contexto (projeto, hábito,
// treino) não passam por aqui: aparecem sempre.

export type AdvancedSection =
  | 'approval'
  | 'myDay'
  | 'time'
  | 'repeat'
  | 'recurrence'
  | 'weight'
  | 'visibility'
  | 'attachments'
  | 'extras';

/** Na ordem em que aparecem no "+ Adicionar". */
export const ADVANCED_SECTIONS: readonly AdvancedSection[] = [
  'recurrence',
  'time',
  'repeat',
  'myDay',
  'weight',
  'visibility',
  'attachments',
  'approval',
  'extras',
];

type TaskLike = {
  approver_id?: string | null;
  approver_role?: string | null;
  estimate_minutes?: number | null;
  actual_minutes?: number | null;
  repeat_plan?: unknown;
  recurrence?: unknown;
  weight?: number | null;
  visibility?: string | null;
};

/** Seções que a tarefa já usa */
export function usedSections(
  task: TaskLike,
  context: { inMyDay: boolean; attachments?: number },
): Set<AdvancedSection> {
  const used = new Set<AdvancedSection>();
  if (task.approver_id || task.approver_role) used.add('approval');
  if (context.inMyDay) used.add('myDay');
  if (task.estimate_minutes || task.actual_minutes) used.add('time');
  if (task.repeat_plan) used.add('repeat');
  if (task.recurrence) used.add('recurrence');
  if ((task.weight ?? 1) > 1) used.add('weight');
  if (task.visibility && task.visibility !== 'private') used.add('visibility');
  if ((context.attachments ?? 0) > 0) used.add('attachments');
  return used;
}

/** A seção aparece? */
export function showSection(
  showAll: boolean,
  used: ReadonlySet<AdvancedSection>,
  added: ReadonlySet<AdvancedSection>,
  s: AdvancedSection,
) {
  return showAll || used.has(s) || added.has(s);
}

/** O que o "+ Adicionar" oferece: as seções que valem aqui e ainda não aparecem. */
export function addableSections(
  available: ReadonlySet<AdvancedSection>,
  showAll: boolean,
  used: ReadonlySet<AdvancedSection>,
  added: ReadonlySet<AdvancedSection>,
) {
  return ADVANCED_SECTIONS.filter(
    (s) => available.has(s) && !showSection(showAll, used, added, s),
  );
}
