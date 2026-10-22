import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, useWindowDimensions, View } from 'react-native';

import { GameHeader } from '@/components/game-bar';
import { GymPrompt } from '@/components/gym-prompt';
import { HeroPanel } from '@/components/hero-panel';
import { MyDaySection, NextActionCard } from '@/components/my-day';
import { NotificationsBell } from '@/components/notifications-bell';
import { ReviewPrompt } from '@/components/review-prompt';
import { Screen, useScreenGutter } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TodayWorkout } from '@/components/gym/week-plan';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { TaskRow } from '@/components/tasks/task-row';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useHabits, useTodayTasks, type HabitTask, type TaskWithPage } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';
import { useSelectableList } from '@/lib/selection';

type Row = { kind: 'task'; task: TaskWithPage } | { kind: 'habit'; task: HabitTask };
type Section = { title: string; count: string; tone?: 'warn'; data: Row[] };

// Hoje (D258): a tela de abertura. Junta o Início e a Hoje antigos, que mostravam quase a mesma
// coisa (a mesma tarefa aparecia duas vezes no Início, em "Fazer agora" e "Para fazer agora").
// Fica o que responde "o que eu faço agora?": a próxima ação, a captura para hoje, atrasadas, de
// hoje e os hábitos do dia. Próximos dias, Entrada sem data e Atribuídas a mim foram para o
// Planejar; o acampamento do RPG, para o Jogo. No computador largo, o herói e os bosses ficam à
// direita; no celular, o jogo é uma faixa de duas linhas.
export default function TodayScreen() {
  const { t } = useTranslation();
  const gutter = useScreenGutter('medium');
  const today = useToday();
  const tree = useTree();
  const tasks = useTodayTasks(today);
  const { width } = useWindowDimensions();
  const narrow = width < 768;
  const wide = width >= 1024;

  const habits = useHabits(today);
  const habitDates = useHabitDates(habits.data ?? []);
  const todaysHabits = (habits.data ?? [])
    .filter((h) => h.habit_kind === 'plusminus' || isHabitDueOn(asRecurrence(h.recurrence), today))
    // Os feitos descem; bom/ruim (sem "feito") fica no fim
    .sort((a, b) => habitOrder(a) - habitOrder(b));
  const withGoal = todaysHabits.filter((h) => h.habit_kind !== 'plusminus');
  const habitsDone = withGoal.filter((h) => h.status === 'done').length;

  const overdue = (tasks.data ?? []).filter((task) => task.due_date! < today);
  // Com horário primeiro, pela hora; as sem horário depois, na ordem de sempre (D206)
  const dueToday = (tasks.data ?? [])
    .filter((task) => task.due_date === today)
    .map((task, i) => ({ task, i }))
    .sort((a, b) =>
      a.task.due_time && b.task.due_time
        ? a.task.due_time.localeCompare(b.task.due_time)
        : a.task.due_time
          ? -1
          : b.task.due_time
            ? 1
            : a.i - b.i,
    )
    .map(({ task }) => task);
  const keyboardOrder = useMemo(() => [...overdue, ...dueToday], [overdue, dueToday]);
  useSelectableList(keyboardOrder);
  const asRows = (list: TaskWithPage[]) => list.map((task) => ({ kind: 'task' as const, task }));
  const candidates: (Section | false)[] = [
    overdue.length > 0 && {
      title: t('today.overdue'),
      count: String(overdue.length),
      tone: 'warn' as const,
      data: asRows(overdue),
    },
    dueToday.length > 0 && {
      title: t('today.dueToday'),
      count: String(dueToday.length),
      data: asRows(dueToday),
    },
    todaysHabits.length > 0 && {
      title: t('today.habits'),
      count: withGoal.length ? `${habitsDone}/${withGoal.length}` : '',
      data: todaysHabits.map((task) => ({ kind: 'habit' as const, task })),
    },
  ];
  const sections = candidates.filter((s): s is Section => !!s);

  // As abas ficam montadas atrás da ativa: fora de foco a Hoje não desenha as listas (repetiria as
  // tarefas na árvore de acessibilidade da página aberta por cima); os dados seguem no cache
  const focused = useIsFocused();
  if (!focused) return <Screen size="medium">{null}</Screen>;

  const list = (
    <SectionList
      sections={sections}
      keyExtractor={(row) => row.task.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      className={cn(gutter.bleed, wide && 'flex-1')}
      contentContainerClassName={cn('pb-clear', gutter.pad)}
      ListHeaderComponent={
        <View className="gap-4">
          <ScreenHeader
            search
            help="comecando"
            eyebrow={formatShortDate(today)}
            title={t('today.title')}
            wrap
            right={
              // Em tela larga a busca e as notificações ficam na barra lateral
              narrow && (
                <>
                  <NotificationsBell />
                </>
              )
            }
          />
          {!wide && <GameHeader />}
          <GymPrompt />
          <ReviewPrompt />
          {/* Sem Meu dia, a sugestão seria só a primeira linha da lista: não repete (A4) */}
          <NextActionCard tasks={[...overdue, ...dueToday]} today={today} onlyWithMyDay />
          <QuickAdd
            pageId={tree.data?.inbox?.id}
            defaultDueDate={today}
            placeholder={t('today.placeholder')}
          />
          <TodayWorkout />
          <MyDaySection today={today} />
          {tasks.error && (
            <Text className="text-sm text-danger">
              {t('common.loadError', { message: tasks.error.message })}
            </Text>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <SectionLabel title={section.title} count={section.count} tone={section.tone} />
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
          <EmptyState title={t('today.empty')} hint={t('today.emptyHint')} />
        )
      }
    />
  );

  return (
    <Screen size={wide ? 'wide' : 'medium'}>
      {wide ? (
        <View className="flex-1 flex-row gap-12">
          {list}
          <View className="w-80 pt-12">
            <HeroPanel />
          </View>
        </View>
      ) : (
        list
      )}
    </Screen>
  );
}

function habitOrder(h: HabitTask) {
  if (h.habit_kind === 'plusminus') return 2;
  return h.status === 'done' ? 1 : 0;
}
