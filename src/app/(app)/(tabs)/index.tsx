import { SectionList, Text, View } from 'react-native';

import { GameHeader } from '@/components/game-bar';
import { NotificationsBell } from '@/components/notifications-bell';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { TaskRow } from '@/components/tasks/task-row';
import { formatShortDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useHabits, useTodayTasks, type HabitTask, type TaskWithPage } from '@/lib/queries/tasks';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';
import { pageLabel, useTree } from '@/lib/queries/tree';

// Hoje: atrasadas + as que vencem hoje, de todas as páginas. A captura daqui vai para a
// Caixa de entrada com vencimento hoje (a não ser que o texto traga outra data).
export default function TodayScreen() {
  const today = useToday();
  const tree = useTree();
  const tasks = useTodayTasks(today);

  const habits = useHabits(today);
  const habitDates = useHabitDates(habits.data ?? []);
  const todaysHabits = (habits.data ?? [])
    .filter((h) => isHabitDueOn(asRecurrence(h.recurrence), today))
    // Os feitos descem
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  const habitsDone = todaysHabits.filter((h) => h.status === 'done').length;

  const overdue = (tasks.data ?? []).filter((t) => t.due_date! < today);
  const dueToday = (tasks.data ?? []).filter((t) => t.due_date === today);
  type Row = { kind: 'task'; task: TaskWithPage } | { kind: 'habit'; task: HabitTask };
  const sections: { title: string; data: Row[] }[] = [
    ...(overdue.length
      ? [
          {
            title: `Atrasadas (${overdue.length})`,
            data: overdue.map((task) => ({ kind: 'task' as const, task })),
          },
        ]
      : []),
    ...(dueToday.length
      ? [
          {
            title: `Hoje (${dueToday.length})`,
            data: dueToday.map((task) => ({ kind: 'task' as const, task })),
          },
        ]
      : []),
    ...(todaysHabits.length
      ? [
          {
            title: `Hábitos (${habitsDone}/${todaysHabits.length})`,
            data: todaysHabits.map((task) => ({ kind: 'habit' as const, task })),
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <ScreenHeader title={`Hoje · ${formatShortDate(today)}`} right={<NotificationsBell />} />
      <GameHeader />
      <QuickAdd
        pageId={tree.data?.inbox?.id}
        defaultDueDate={today}
        placeholder="Nova tarefa para hoje…"
      />
      {tasks.error && (
        <Text className="mt-4 text-destructive">Erro ao carregar: {tasks.error.message}</Text>
      )}
      <SectionList
        className="mt-2"
        sections={sections}
        keyExtractor={(row) => row.task.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text
            className={
              section.title.startsWith('Atrasadas')
                ? 'mt-4 text-sm font-semibold text-destructive'
                : 'mt-4 text-sm font-semibold text-muted-foreground'
            }
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'habit' ? (
            <HabitRow
              task={item.task}
              dates={habitDates.datesOf(item.task)}
              today={today}
              pageLabel={pageLabel(item.task.page)}
            />
          ) : (
            <TaskRow
              task={item.task}
              today={today}
              pageLabel={item.task.page ? pageLabel(item.task.page) : undefined}
            />
          )
        }
        ListEmptyComponent={
          tasks.isPending || habits.isPending ? null : (
            <View className="mt-10 items-center gap-1">
              <Text className="text-4xl">🎉</Text>
              <Text className="text-center text-muted-foreground">Nada para hoje.</Text>
              <Text className="text-center text-sm text-muted-foreground">
                Dica: escreva &quot;amanhã&quot;, &quot;sexta&quot; ou &quot;15/10&quot; no título
                para dar uma data.
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
