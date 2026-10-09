import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { formatDueDate } from '@/lib/parser/dates';
import type { Task } from '@/lib/queries/tasks';
import { asRecurrence, recurrenceLabel } from '@/lib/recurrence';

const PRIORITY_LABEL = ['', '!', '!!', '!!!'];
const PRIORITY_COLOR = ['', 'text-sky-600', 'text-amber-600', 'text-destructive'];

/** Linha de detalhes da tarefa: vencimento, prioridade, etiquetas, subtarefas e página. */
export function TaskMeta({
  task,
  today,
  subtasks,
  pageLabel,
  hideRecurrence,
}: {
  task: Pick<Task, 'due_date' | 'priority' | 'labels' | 'status' | 'recurrence' | 'meta'>;
  today: string;
  subtasks?: { done: number; total: number };
  pageLabel?: string;
  /** Nos hábitos a recorrência já aparece de outro jeito */
  hideRecurrence?: boolean;
}) {
  const recurrence = hideRecurrence ? '' : recurrenceLabel(asRecurrence(task.recurrence));
  const detail = metaLabel(task.meta);
  const overdue = !!task.due_date && task.due_date < today && task.status !== 'done';
  const parts = [
    task.due_date && (
      <Text
        key="due"
        className={cn(
          'text-xs',
          overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
        )}
      >
        📅 {formatDueDate(task.due_date, today)}
      </Text>
    ),
    task.priority > 0 && (
      <Text key="priority" className={cn('text-xs font-bold', PRIORITY_COLOR[task.priority])}>
        {PRIORITY_LABEL[task.priority]}
      </Text>
    ),
    recurrence && (
      <Text key="recurrence" className="text-xs text-muted-foreground">
        🔁 {recurrence}
      </Text>
    ),
    detail && (
      <Text key="detail" className="text-xs text-muted-foreground">
        {detail}
      </Text>
    ),
    subtasks && subtasks.total > 0 && (
      <Text key="subtasks" className="text-xs text-muted-foreground">
        ☑ {subtasks.done}/{subtasks.total}
      </Text>
    ),
    ...task.labels.map((label) => (
      <Text key={`label-${label}`} className="text-xs text-primary">
        #{label}
      </Text>
    )),
    pageLabel && (
      <Text key="page" className="text-xs text-muted-foreground" numberOfLines={1}>
        {pageLabel}
      </Text>
    ),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">{parts}</View>;
}

/** "4x12 · 20kg" a partir do meta da tarefa (cards). */
export function metaLabel(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return '';
  const m = meta as { sets?: unknown; reps?: unknown; weight?: unknown };
  const parts: string[] = [];
  if (typeof m.sets === 'number' && typeof m.reps === 'number') parts.push(`${m.sets}x${m.reps}`);
  else if (typeof m.sets === 'number') parts.push(`${m.sets} séries`);
  else if (typeof m.reps === 'number') parts.push(`${m.reps} reps`);
  if (typeof m.weight === 'string' && m.weight) parts.push(m.weight);
  return parts.join(' · ');
}
