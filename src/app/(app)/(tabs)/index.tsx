import { Link, useIsFocused, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { GameHeader } from '@/components/game-bar';
import { HeroPanel } from '@/components/hero-panel';
import { NotificationsBell } from '@/components/notifications-bell';
import { NextActionCard } from '@/components/my-day';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { TaskRow } from '@/components/tasks/task-row';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotesBlock } from '@/components/notes-block';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { addDays, formatShortDate } from '@/lib/parser/dates';
import { useMyTasks } from '@/lib/queries/projects';
import { useProfile, useToday } from '@/lib/queries/profile';
import {
  useHabits,
  usePageTasks,
  useTodayTasks,
  useUpcomingTasks,
  type TaskWithPage,
} from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';

/** Quantos itens cada seção mostra antes do "ver tudo". */
const PREVIEW = 6;

// Início: visão geral do que está pendente — atrasadas e de hoje, hábitos do dia, próximos
// 7 dias, Caixa de entrada e (em projetos) o que foi atribuído a você. Sem cartões de número em
// grade: o resumo é uma linha em mono, e as seções são listas com rótulo, sem caixa.
// No computador, o personagem e o boss ficam numa coluna à direita.
export default function HomeScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const profile = useProfile();
  const tree = useTree();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  // Tela bem larga (1600+): as listas se dividem em duas colunas ao lado do personagem
  const triple = width >= 1600;

  const todayTasks = useTodayTasks(today);
  const upcoming = useUpcomingTasks(today, addDays(today, 7));
  const inbox = usePageTasks(tree.data?.inbox?.id);
  const habits = useHabits(today);
  const habitDates = useHabitDates(habits.data ?? []);
  // "Atribuídas a mim" só faz sentido para quem participa de algum projeto
  const inProject = !!tree.data?.folders.some((f) => f.is_shared);
  const mine = useMyTasks({ enabled: inProject });

  const overdue = (todayTasks.data ?? []).filter((task) => task.due_date! < today);
  const dueToday = (todayTasks.data ?? []).filter((task) => task.due_date === today);
  // Da Caixa de entrada, só o que ainda não tem data (o que tem já aparece em "agora" ou nos próximos dias)
  const inboxOpen = (inbox.data ?? []).filter(
    (task) => !task.parent_task_id && task.status !== 'done' && !task.due_date,
  );
  const todaysHabits = (habits.data ?? []).filter(
    (h) => h.habit_kind === 'plusminus' || isHabitDueOn(asRecurrence(h.recurrence), today),
  );
  const withGoal = todaysHabits.filter((h) => h.habit_kind !== 'plusminus');
  const habitsDone = withGoal.filter((h) => h.status === 'done').length;
  const pendingHabits = todaysHabits
    .filter((h) => h.habit_kind === 'plusminus' || h.status !== 'done')
    .sort((a, b) => Number(a.habit_kind === 'plusminus') - Number(b.habit_kind === 'plusminus'));
  const assigned = inProject ? (mine.data ?? []) : [];

  // As abas ficam montadas atrás da ativa: fora de foco o Início não desenha as listas (repetiria
  // as tarefas da Hoje na árvore da página e custaria render à toa); os dados seguem no cache
  const focused = useIsFocused();
  const firstName = profile.data?.display_name.split(' ')[0];
  const nothingPending =
    !todayTasks.isPending &&
    overdue.length + dueToday.length + pendingHabits.length + inboxOpen.length === 0;
  const labelOf = (task: TaskWithPage) => (task.page ? pageLabel(task.page) : undefined);

  // Resumo em uma linha: cada número leva para a tela dele
  const summary = (
    // -mx-2: cada número tem a folga do realce sem desalinhar o primeiro do título
    <View className="-mx-2 flex-row flex-wrap items-center gap-1">
      <Stat href="/today" warn={overdue.length > 0}>
        {t('home.overdue', { count: overdue.length })}
      </Stat>
      <Stat href="/today">{t('home.today', { count: dueToday.length })}</Stat>
      <Stat href="/habits">
        {withGoal.length
          ? t('home.habits', { done: habitsDone, total: withGoal.length })
          : t('home.habitsCount', { count: todaysHabits.length })}
      </Stat>
      <Stat href="/inbox">{t('home.noDate', { count: inboxOpen.length })}</Stat>
    </View>
  );

  const nowSection = (
    <>
      <Section
        title={t('home.now')}
        count={overdue.length + dueToday.length}
        link={{ href: '/today', label: t('home.openToday') }}
        empty={overdue.length + dueToday.length === 0 ? t('home.nowEmpty') : undefined}
      >
        {[...overdue, ...dueToday].slice(0, PREVIEW).map((task) => (
          <TaskRow key={task.id} task={task} today={today} pageLabel={labelOf(task)} />
        ))}
        <More count={overdue.length + dueToday.length} />
      </Section>
    </>
  );
  const laterSections = (
    <>
      <Section
        title={t('home.upcoming')}
        count={(upcoming.data ?? []).length}
        empty={(upcoming.data ?? []).length === 0 ? t('home.upcomingEmpty') : undefined}
      >
        {(upcoming.data ?? []).slice(0, PREVIEW).map((task) => (
          <TaskRow key={task.id} task={task} today={today} pageLabel={labelOf(task)} />
        ))}
        <More count={(upcoming.data ?? []).length} />
      </Section>
      <Section
        title={t('home.inbox')}
        count={inboxOpen.length}
        link={{ href: '/inbox', label: t('home.open') }}
        empty={inboxOpen.length === 0 ? t('home.inboxEmpty') : undefined}
      >
        {inboxOpen.slice(0, PREVIEW).map((task) => (
          <TaskRow key={task.id} task={task} today={today} />
        ))}
        <More count={inboxOpen.length} />
      </Section>
      {assigned.length > 0 && (
        <Section
          title={t('home.mine')}
          count={assigned.length}
          link={{ href: '/mine', label: t('home.seeAll') }}
        >
          {assigned.slice(0, PREVIEW).map((task) => (
            <TaskRow key={task.id} task={task} today={today} pageLabel={labelOf(task)} />
          ))}
          <More count={assigned.length} />
        </Section>
      )}
    </>
  );

  const habitsSection = (
    <Section
      title={t('home.habitsToday')}
      count={withGoal.length ? `${habitsDone}/${withGoal.length}` : undefined}
      link={{ href: '/habits', label: t('home.allHabits') }}
      empty={
        todaysHabits.length === 0
          ? t('home.habitsNone')
          : pendingHabits.length === 0
            ? t('home.habitsAllDone')
            : undefined
      }
    >
      {pendingHabits.map((h) => (
        <HabitRow key={h.id} task={h} dates={habitDates.datesOf(h)} today={today} />
      ))}
    </Section>
  );

  if (!focused) return <Screen size="full">{null}</Screen>;

  return (
    <Screen size="full">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <View className={cn('w-full self-center', !triple && 'max-w-[1120px]')}>
          <ScreenHeader
            eyebrow={`${formatShortDate(today)} · ${t(nothingPending ? 'home.nothing' : 'home.pending')}`}
            title={firstName ? t('home.hello', { name: firstName }) : t('home.title')}
            right={
              width < 768 && (
                <>
                  <ThemeToggle />
                  <NotificationsBell />
                </>
              )
            }
          />
          {summary}
          <View className="pt-4">
            <NextActionCard tasks={[...overdue, ...dueToday]} today={today} />
          </View>
          {triple ? (
            <View className="mt-4 flex-row items-start gap-12">
              <View className="flex-1">
                {habitsSection}
                {nowSection}
              </View>
              <View className="flex-1">{laterSections}</View>
              <View className="w-80 pt-6">
                <HeroPanel />
              </View>
            </View>
          ) : wide ? (
            <View className="mt-4 flex-row items-start gap-12">
              <View className="flex-1">
                {habitsSection}
                {nowSection}
                {laterSections}
              </View>
              <View className="w-80 pt-6">
                <HeroPanel />
              </View>
            </View>
          ) : (
            <View className="mt-4">
              <GameHeader />
              {/* W3: no celular as anotações ficam no Início (no computador, na barra lateral) */}
              <NotesBlock limit={3} />
              {habitsSection}
              {nowSection}
              {laterSections}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ href, warn, children }: { href: Href; warn?: boolean; children: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        className="min-h-8 justify-center rounded px-2 hover:bg-wash active:bg-wash"
      >
        <Text className={cn('font-mono text-xs', warn ? 'text-warn' : 'text-ink-muted')}>
          {children}
        </Text>
      </Pressable>
    </Link>
  );
}

function Section({
  title,
  count,
  link,
  empty,
  children,
}: {
  title: string;
  count?: number | string;
  link?: { href: Href; label: string };
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <View>
      <SectionLabel
        title={title}
        count={count === 0 ? undefined : count}
        right={
          // Sem link, a mesma altura: as colunas lado a lado começam alinhadas
          !link ? (
            <View className="min-h-8" />
          ) : (
            <Link href={link.href} asChild>
              <Pressable
                accessibilityRole="link"
                className="-mr-2 min-h-8 justify-center rounded px-2 hover:bg-wash active:bg-wash"
              >
                <Text className="text-xs font-semibold text-ink">{link.label}</Text>
              </Pressable>
            </Link>
          )
        }
      />
      {empty ? <Text className="py-3 text-sm text-ink-muted">{empty}</Text> : children}
    </View>
  );
}

/** "e mais N" quando a seção cortou a lista. */
function More({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= PREVIEW) return null;
  return (
    <Text className="pt-2 font-mono text-xs text-ink-muted">
      {t('home.more', { count: count - PREVIEW })}
    </Text>
  );
}
