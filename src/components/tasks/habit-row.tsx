import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { addDays, type IsoDate } from '@/lib/parser/dates';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import { useCompletionDates, type Task } from '@/lib/queries/tasks';
import {
  asRecurrence,
  habitPeriodKey,
  habitStreak,
  isHabitDueOn,
  recurrenceLabel,
} from '@/lib/recurrence';
import { useCanWrite } from '@/providers/write';
import { DragHandle } from './sortable-tasks';
import { useToggleWithUndo } from './task-row';

const HISTORY_DAYS = 400;

/**
 * Datas em que cada hábito foi feito (histórico do banco), já com a marcação atual aplicada:
 * marcar/desmarcar agora atualiza a sequência na hora, sem esperar o servidor.
 */
export function useHabitDates(tasks: Task[]) {
  const today = useToday();
  const timeZone = useTimeZone();
  const since = `${addDays(today, -HISTORY_DAYS)}T00:00:00Z`;
  const completions = useCompletionDates(
    tasks.map((t) => t.id),
    since,
    timeZone,
  );

  const datesOf = (task: Task): IsoDate[] => {
    const r = asRecurrence(task.recurrence);
    const current = habitPeriodKey(r, today);
    const history = (completions.data?.[task.id] ?? []).filter(
      (d) => habitPeriodKey(r, d) !== current,
    );
    // O período atual vem do status (que já tem a atualização otimista)
    return task.status === 'done' ? [...history, today] : history;
  };
  return { datesOf, today };
}

export function HabitRow({
  task,
  dates,
  today,
  draggable,
  pageLabel,
}: {
  task: Task;
  dates: IsoDate[];
  today: IsoDate;
  draggable?: boolean;
  pageLabel?: string;
}) {
  const writable = useCanWrite(task.folder_id, { offline: true });
  const toggle = useToggleWithUndo();
  const r = asRecurrence(task.recurrence);
  const done = task.status === 'done';
  const streak = habitStreak(r, dates, today);
  const doneSet = new Set(dates);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <View className="min-h-16 flex-row items-center border-b border-border bg-background">
      {draggable && <DragHandle label={task.title} />}
      <Checkbox
        checked={done}
        disabled={!writable}
        label={done ? `Desmarcar ${task.title}` : `Feito: ${task.title}`}
        onChange={(checked) => toggle(task, checked)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${task.title}`}
        className="flex-1 gap-1 py-2"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text className={cn('text-base', done ? 'text-muted-foreground' : 'text-foreground')}>
          {task.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-3">
          <Text className="text-xs text-muted-foreground">{recurrenceLabel(r) || 'Todo dia'}</Text>
          {pageLabel && <Text className="text-xs text-muted-foreground">{pageLabel}</Text>}
        </View>
      </Pressable>
      <View className="items-end gap-1 pr-2">
        <Text
          className={cn(
            'text-sm font-bold',
            streak > 0 ? 'text-amber-600' : 'text-muted-foreground',
          )}
          accessibilityLabel={`Sequência de ${streak}`}
        >
          🔥 {streak}
        </Text>
        <View className="flex-row gap-1" accessibilityLabel="Últimos 7 dias">
          {week.map((day) => (
            <View
              key={day}
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                doneSet.has(day)
                  ? 'bg-primary'
                  : isHabitDueOn(r, day)
                    ? 'border border-muted-foreground'
                    : 'bg-muted',
              )}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
