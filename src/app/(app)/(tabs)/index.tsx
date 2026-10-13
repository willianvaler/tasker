import { Link, useIsFocused, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { GameHeader } from '@/components/game-bar';
import { HeroPanel } from '@/components/hero-panel';
import { NotificationsBell } from '@/components/notifications-bell';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { TaskRow } from '@/components/tasks/task-row';
import { ThemeToggle } from '@/components/theme-toggle';
import { Grid } from '@/components/ui/grid';
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

/** Quantos itens cada cartão mostra antes do "ver tudo". */
const PREVIEW = 6;

// Início (D69): visão geral do que está pendente — atrasadas e de hoje, hábitos do dia, próximos
// 7 dias, Caixa de entrada e (em projetos) o que foi atribuído a você — e o personagem com o boss.
export default function HomeScreen() {
  const today = useToday();
  const profile = useProfile();
  const tree = useTree();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;

  const todayTasks = useTodayTasks(today);
  const upcoming = useUpcomingTasks(today, addDays(today, 7));
  const inbox = usePageTasks(tree.data?.inbox?.id);
  const habits = useHabits(today);
  const habitDates = useHabitDates(habits.data ?? []);
  // "Atribuídas a mim" só faz sentido para quem participa de algum projeto
  const inProject = !!tree.data?.folders.some((f) => f.is_shared);
  const mine = useMyTasks({ enabled: inProject });

  const overdue = (todayTasks.data ?? []).filter((t) => t.due_date! < today);
  const dueToday = (todayTasks.data ?? []).filter((t) => t.due_date === today);
  // Da Caixa de entrada, só o que ainda não tem data (o que tem já aparece em "agora" ou nos próximos dias)
  const inboxOpen = (inbox.data ?? []).filter(
    (t) => !t.parent_task_id && t.status !== 'done' && !t.due_date,
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

  const tiles = (
    <Grid breakpoints={[300, 300, 300]} gap={10}>
      <Tile href="/today" label="Atrasadas" value={overdue.length} alert={overdue.length > 0} />
      <Tile href="/today" label="Hoje" value={dueToday.length} />
      <Tile
        href="/habits"
        label="Hábitos"
        value={withGoal.length ? `${habitsDone}/${withGoal.length}` : todaysHabits.length}
      />
      <Tile href="/inbox" label="Sem data" value={inboxOpen.length} />
    </Grid>
  );

  const left = (
    <View className="gap-4">
      <Card
        title="Para fazer agora"
        link={{ href: '/today', label: 'Abrir Hoje' }}
        empty={
          overdue.length + dueToday.length === 0 ? 'Nada atrasado nem para hoje. 🎉' : undefined
        }
      >
        {[...overdue, ...dueToday].slice(0, PREVIEW).map((t) => (
          <TaskRow key={t.id} task={t} today={today} pageLabel={labelOf(t)} />
        ))}
        <More count={overdue.length + dueToday.length} />
      </Card>

      <Card
        title="Próximos 7 dias"
        empty={(upcoming.data ?? []).length === 0 ? 'Nada marcado para a semana.' : undefined}
      >
        {(upcoming.data ?? []).slice(0, PREVIEW).map((t) => (
          <TaskRow key={t.id} task={t} today={today} pageLabel={labelOf(t)} />
        ))}
        <More count={(upcoming.data ?? []).length} />
      </Card>

      <Card
        title="Caixa de entrada, sem data"
        link={{ href: '/inbox', label: 'Abrir' }}
        empty={inboxOpen.length === 0 ? 'Nada solto: tudo tem data ou pasta.' : undefined}
      >
        {inboxOpen.slice(0, PREVIEW).map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
        <More count={inboxOpen.length} />
      </Card>

      {assigned.length > 0 && (
        <Card title="Atribuídas a mim" link={{ href: '/mine', label: 'Ver todas' }}>
          {assigned.slice(0, PREVIEW).map((t) => (
            <TaskRow key={t.id} task={t} today={today} pageLabel={labelOf(t)} />
          ))}
          <More count={assigned.length} />
        </Card>
      )}
    </View>
  );

  const habitsCard = (
    <Card
      title={
        withGoal.length ? `Hábitos de hoje (${habitsDone}/${withGoal.length})` : 'Hábitos de hoje'
      }
      link={{ href: '/habits', label: 'Todos os hábitos' }}
      empty={
        todaysHabits.length === 0
          ? 'Nenhum hábito ainda.'
          : pendingHabits.length === 0
            ? 'Todos feitos hoje! 🔥'
            : undefined
      }
    >
      {pendingHabits.map((h) => (
        <HabitRow key={h.id} task={h} dates={habitDates.datesOf(h)} today={today} />
      ))}
    </Card>
  );

  if (!focused) return <Screen size="wide">{null}</Screen>;

  return (
    <Screen size="wide">
      <ScreenHeader
        title={firstName ? `Olá, ${firstName}` : 'Início'}
        right={
          <View className="flex-row items-center">
            {width < 768 && <ThemeToggle />}
            <NotificationsBell />
          </View>
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-28">
        <Text className="text-muted-foreground">
          {formatShortDate(today)} ·{' '}
          {nothingPending ? 'nada pendente por enquanto' : 'o que está pendente'}
        </Text>
        {!wide && <GameHeader />}
        {tiles}
        {wide ? (
          <View className="flex-row items-start gap-6">
            <View className="flex-1">{left}</View>
            <View className="w-[420px] gap-4">
              <HeroPanel />
              {habitsCard}
            </View>
          </View>
        ) : (
          <>
            {habitsCard}
            {left}
          </>
        )}
      </ScrollView>
    </Screen>
  );

  function labelOf(t: TaskWithPage) {
    return t.page ? pageLabel(t.page) : undefined;
  }
}

function Tile({
  href,
  label,
  value,
  alert,
}: {
  href: Href;
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${label}: ${value}`}
        className="gap-1 rounded-2xl border border-border bg-card p-3 active:opacity-80 md:p-4"
      >
        <Text
          className={cn(
            'text-xl font-bold md:text-2xl',
            alert ? 'text-destructive' : 'text-foreground',
          )}
        >
          {value}
        </Text>
        <Text className="text-xs text-muted-foreground md:text-sm" numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function Card({
  title,
  link,
  empty,
  children,
}: {
  title: string;
  link?: { href: Href; label: string };
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-border bg-card px-4 pb-3 pt-3">
      <View className="min-h-11 flex-row items-center justify-between">
        <Text className="text-base font-bold text-foreground" accessibilityRole="header">
          {title}
        </Text>
        {link && (
          <Link href={link.href} asChild>
            <Pressable accessibilityRole="link" className="min-h-11 justify-center px-1">
              <Text className="text-sm font-semibold text-primary">{link.label} →</Text>
            </Pressable>
          </Link>
        )}
      </View>
      {empty ? <Text className="pb-1 text-sm text-muted-foreground">{empty}</Text> : children}
    </View>
  );
}

/** "e mais N" quando o cartão cortou a lista. */
function More({ count }: { count: number }) {
  if (count <= PREVIEW) return null;
  return <Text className="pt-2 text-xs text-muted-foreground">e mais {count - PREVIEW}</Text>;
}
