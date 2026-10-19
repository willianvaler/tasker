import { Repeat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatDueDate } from '@/lib/parser/dates';
import type { Task } from '@/lib/queries/tasks';
import { asRecurrence, recurrenceLabel } from '@/lib/recurrence';

const PRIORITY_LABEL = ['', '!', '!!', '!!!'];
const PRIORITY_COLOR = ['', 'text-ink-muted', 'text-warn', 'text-accent'];

/** Linha de detalhes da tarefa: vencimento, prioridade, etiquetas, subtarefas e página. */
export function TaskMeta({
  task,
  today,
  subtasks,
  pageLabel,
  hideRecurrence,
}: {
  task: Pick<Task, 'due_date' | 'priority' | 'labels' | 'status' | 'recurrence' | 'meta'> &
    Partial<Pick<Task, 'due_time' | 'remind_before'>>;
  today: string;
  subtasks?: { done: number; total: number };
  pageLabel?: string;
  /** Nos hábitos a recorrência já aparece de outro jeito */
  hideRecurrence?: boolean;
}) {
  const { t } = useTranslation();
  const recurrence = hideRecurrence ? '' : recurrenceLabel(asRecurrence(task.recurrence));
  const detail = metaLabel(task.meta);
  const overdue = !!task.due_date && task.due_date < today && task.status !== 'done';
  // Metadados em mono, pequenos, sem emoji; atraso em `warn`
  const meta = 'font-mono text-xs text-ink-muted';
  const parts = [
    task.due_date && (
      <Text
        key="due"
        className={cn(meta, overdue && 'text-warn')}
        accessibilityLabel={t('task.due', {
          date: [formatDueDate(task.due_date, today), shortTime(task.due_time)]
            .filter(Boolean)
            .join(' '),
        })}
      >
        {formatDueDate(task.due_date, today)}
        {task.due_time ? ` ${shortTime(task.due_time)}` : ''}
        {task.due_time && task.remind_before != null ? ' 🔔' : ''}
      </Text>
    ),
    task.priority > 0 && (
      <Text key="priority" className={cn('font-mono text-xs', PRIORITY_COLOR[task.priority])}>
        {PRIORITY_LABEL[task.priority]}
      </Text>
    ),
    recurrence && (
      <View
        key="recurrence"
        className="flex-row items-center gap-1"
        accessibilityLabel={t('task.recurrence', { rule: recurrence })}
      >
        <Icon icon={Repeat} size={16} tone="ink-muted" />
        <Text className={meta}>{recurrence}</Text>
      </View>
    ),
    detail && (
      <Text key="detail" className={meta}>
        {detail}
      </Text>
    ),
    subtasks && subtasks.total > 0 && (
      // Régua fina: o progresso da mãe pelas folhas do galho
      <View
        key="subtasks"
        className="flex-row items-center gap-1"
        accessibilityLabel={t('task.subtasks', subtasks)}
      >
        <View className="h-1 w-8 overflow-hidden rounded-full bg-line">
          <View
            className="h-1 bg-accent"
            style={{ width: `${Math.round((subtasks.done / subtasks.total) * 100)}%` }}
          />
        </View>
        <Text className={meta}>
          {subtasks.done}/{subtasks.total}
        </Text>
      </View>
    ),
    ...task.labels.map((label) => (
      <Text key={`label-${label}`} className="text-xs text-ink-muted">
        #{label}
      </Text>
    )),
    pageLabel && (
      <Text key="page" className={cn(meta, 'max-w-40')} numberOfLines={1}>
        {pageLabel}
      </Text>
    ),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">{parts}</View>;
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

/** '15:00:00' → '15:00' (horário da tarefa, D206). */
export function shortTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : '';
}
