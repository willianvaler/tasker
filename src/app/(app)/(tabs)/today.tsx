import { ScrollView, SectionList, Text, useWindowDimensions, View } from 'react-native';

import { GameHeader } from '@/components/game-bar';
import { HeroPanel } from '@/components/hero-panel';
import { NotificationsBell } from '@/components/notifications-bell';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { TaskRow } from '@/components/tasks/task-row';
import { ThemeToggle } from '@/components/theme-toggle';
import { formatShortDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useHabits, useTodayTasks, type HabitTask, type TaskWithPage } from '@/lib/queries/tasks';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';
import { pageLabel, useTree } from '@/lib/queries/tree';

/** A partir daqui a tela Hoje usa duas colunas (D67). */
const TWO_COLUMNS = 1024;

type Row = { kind: 'task'; task: TaskWithPage } | { kind: 'habit'; task: HabitTask };

// Hoje: atrasadas + as que vencem hoje, de todas as páginas, e os hábitos do dia. A captura daqui vai
// para a Caixa de entrada com vencimento hoje (a não ser que o texto traga outra data).
// No computador: tarefas à esquerda; personagem, bosses e hábitos à direita.
export default function TodayScreen() {
  const today = useToday();
  const tree = useTree();
  const tasks = useTodayTasks(today);
  const { width } = useWindowDimensions();
  const twoColumns = width >= TWO_COLUMNS;

  const habits = useHabits(today);
  const habitDates = useHabitDates(habits.data ?? []);
  const todaysHabits = (habits.data ?? [])
    .filter((h) => h.habit_kind === 'plusminus' || isHabitDueOn(asRecurrence(h.recurrence), today))
    // Os feitos descem; bom/ruim (sem "feito") fica no fim
    .sort((a, b) => habitOrder(a) - habitOrder(b));
  const withGoal = todaysHabits.filter((h) => h.habit_kind !== 'plusminus');
  const habitsDone = withGoal.filter((h) => h.status === 'done').length;
  const habitsTitle = withGoal.length ? `Hábitos (${habitsDone}/${withGoal.length})` : 'Hábitos';

  const overdue = (tasks.data ?? []).filter((t) => t.due_date! < today);
  const dueToday = (tasks.data ?? []).filter((t) => t.due_date === today);
  const taskSections: { title: string; data: Row[] }[] = [
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
  ];
  const habitSection = todaysHabits.length
    ? [
        {
          title: habitsTitle,
          data: todaysHabits.map((task) => ({ kind: 'habit' as const, task })),
        },
      ]
    : [];
  const sections = twoColumns ? taskSections : [...taskSections, ...habitSection];

  const renderRow = (item: Row) =>
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
    );

  const list = (
    <SectionList
      className="mt-2"
      sections={sections}
      keyExtractor={(row) => row.task.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <SectionTitle title={section.title} />}
      renderItem={({ item }) => renderRow(item)}
      ListEmptyComponent={
        tasks.isPending || habits.isPending ? null : (
          <View className="mt-10 items-center gap-1">
            <Text className="text-4xl">🎉</Text>
            <Text className="text-center text-ink-muted">Nada para hoje.</Text>
            <Text className="text-center text-sm text-ink-muted">
              Dica: escreva &quot;amanhã&quot;, &quot;sexta&quot; ou &quot;15/10&quot; no título
              para dar uma data.
            </Text>
          </View>
        )
      }
    />
  );

  return (
    <Screen size="wide">
      <ScreenHeader
        title={`Hoje · ${formatShortDate(today)}`}
        right={
          <View className="flex-row items-center">
            {/* Em tela larga o botão de tema fica na barra lateral */}
            {width < 768 && <ThemeToggle />}
            <NotificationsBell />
          </View>
        }
      />
      {twoColumns ? (
        <View className="flex-1 flex-row gap-8">
          <View className="flex-1">
            <QuickAdd
              pageId={tree.data?.inbox?.id}
              defaultDueDate={today}
              placeholder="Nova tarefa para hoje…"
            />
            {tasks.error && (
              <Text className="mt-4 text-danger">Erro ao carregar: {tasks.error.message}</Text>
            )}
            {list}
          </View>
          <ScrollView className="w-[420px] flex-none" contentContainerClassName="gap-4 pb-16">
            <HeroPanel />
            {todaysHabits.length > 0 && (
              <View className="rounded-2xl border border-line bg-surface px-3 pb-2">
                <SectionTitle title={habitsTitle} />
                {todaysHabits.map((task) => (
                  <View key={task.id}>{renderRow({ kind: 'habit', task })}</View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        <>
          <GameHeader />
          <QuickAdd
            pageId={tree.data?.inbox?.id}
            defaultDueDate={today}
            placeholder="Nova tarefa para hoje…"
          />
          {tasks.error && (
            <Text className="mt-4 text-danger">Erro ao carregar: {tasks.error.message}</Text>
          )}
          {list}
        </>
      )}
    </Screen>
  );
}

function habitOrder(h: HabitTask) {
  if (h.habit_kind === 'plusminus') return 2;
  return h.status === 'done' ? 1 : 0;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      className={
        title.startsWith('Atrasadas')
          ? 'mt-4 text-sm font-semibold text-danger'
          : 'mt-4 text-sm font-semibold text-ink-muted'
      }
    >
      {title}
    </Text>
  );
}
