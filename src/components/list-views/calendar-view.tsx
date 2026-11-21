import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { TaskRow } from '@/components/tasks/task-row';
import { Button, IconButton } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { monthGrid, monthOf, shiftMonth } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import {
  dateLocale,
  formatDueDate,
  formatMonthYear,
  formatShortDate,
  weekdayOf,
  weekdayShort,
} from '@/lib/parser/dates';
import type { Task } from '@/lib/queries/tasks';

/** Quantas tarefas cabem numa célula (o resto vira "+N") */
const CELL_ITEMS = 3;

/**
 * Visão Calendário da lista (VS1): o mês com as tarefas desta lista pelo vencimento; tocar no dia
 * mostra as dele embaixo. As sem data ficam numa seção à parte, para dar uma data.
 */
export function CalendarView({
  tasks,
  today,
  subtaskCount,
}: {
  tasks: Task[];
  today: string;
  subtaskCount: Map<string, { done: number; total: number }>;
}) {
  const { t } = useTranslation();
  const compact = useWindowDimensions().width < 768;
  const weekStart = dateLocale() === 'es' ? 1 : 0;
  const [selected, setSelected] = useState(today);
  const month = monthOf(selected);
  const weeks = monthGrid(month, weekStart);
  const byDay = new Map<string, Task[]>();
  const undated: Task[] = [];
  for (const task of tasks) {
    if (!task.due_date) {
      undated.push(task);
      continue;
    }
    const list = byDay.get(task.due_date);
    if (list) list.push(task);
    else byDay.set(task.due_date, [task]);
  }
  const label = formatMonthYear(month);
  const dayTasks = byDay.get(selected) ?? [];

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label={t('calendar.previous')}
          onPress={() => setSelected(`${shiftMonth(month, -1)}-01`)}
        />
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 text-center text-base font-semibold text-ink"
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </Text>
        <IconButton
          icon={ChevronRight}
          label={t('calendar.next')}
          onPress={() => setSelected(`${shiftMonth(month, 1)}-01`)}
        />
        <Button
          variant="ghost"
          label={t('calendar.today')}
          disabled={selected === today}
          onPress={() => setSelected(today)}
        />
      </View>
      <View role="grid" aria-label={label}>
        <View className="flex-row border-b border-line">
          {weeks[0].map((date) => (
            <Text
              key={date}
              className="flex-1 pb-1 text-center font-mono text-xs uppercase text-ink-muted"
            >
              {weekdayShort(weekdayOf(date))}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} className="flex-row" role="row">
            {week.map((date) => {
              const items = byDay.get(date) ?? [];
              const isSelected = date === selected;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  aria-selected={isSelected}
                  accessibilityLabel={
                    items.length
                      ? t('calendar.dayWithItems', {
                          date: formatShortDate(date),
                          count: items.length,
                        })
                      : formatShortDate(date)
                  }
                  onPress={() => setSelected(date)}
                  className={cn(
                    'min-w-0 flex-1 gap-1 border-b border-r border-line p-1 hover:bg-wash',
                    compact ? 'min-h-12' : 'min-h-24',
                    date === week[0] && 'border-l',
                    isSelected && 'bg-accent-soft hover:bg-accent-soft',
                  )}
                >
                  <View
                    className={cn(
                      'h-6 w-6 items-center justify-center self-center rounded-full md:self-start',
                      date === today && 'bg-accent',
                    )}
                  >
                    <Text
                      className={cn(
                        'font-mono text-xs',
                        date === today
                          ? 'text-on-accent'
                          : monthOf(date) !== month
                            ? 'text-ink-muted'
                            : 'text-ink',
                      )}
                    >
                      {Number(date.slice(8))}
                    </Text>
                  </View>
                  {compact ? (
                    <View className="flex-row flex-wrap justify-center gap-1">
                      {items.slice(0, CELL_ITEMS).map((task) => (
                        <View key={task.id} className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
                      ))}
                    </View>
                  ) : (
                    <>
                      {items.slice(0, CELL_ITEMS).map((task) => (
                        <Text
                          key={task.id}
                          numberOfLines={1}
                          className={cn(
                            'px-1 text-xs',
                            task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                          )}
                        >
                          {task.title}
                        </Text>
                      ))}
                      {items.length > CELL_ITEMS && (
                        <Text className="px-1 font-mono text-xs text-ink-muted">
                          {t('calendar.more', { count: items.length - CELL_ITEMS })}
                        </Text>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View>
        <SectionLabel title={formatDueDate(selected, today)} count={dayTasks.length} />
        {dayTasks.length === 0 ? (
          <Text className="py-2 text-sm text-ink-muted">{t('views.dayEmpty')}</Text>
        ) : (
          dayTasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} subtasks={subtaskCount.get(task.id)} />
          ))
        )}
      </View>
      {undated.length > 0 && (
        <View>
          <SectionLabel title={t('views.undated')} count={undated.length} />
          {undated.map((task) => (
            <TaskRow key={task.id} task={task} today={today} subtasks={subtaskCount.get(task.id)} />
          ))}
        </View>
      )}
    </View>
  );
}
