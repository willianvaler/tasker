import { Link, useIsFocused, type Href } from 'expo-router';
import { CalendarDays, ClipboardCheck, UserCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { HubRow, HubSection } from '@/components/hub';
import { NotificationsBell } from '@/components/notifications-bell';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TaskRow } from '@/components/tasks/task-row';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { addDays } from '@/lib/parser/dates';
import { useMyTasks } from '@/lib/queries/projects';
import { useToday, useUiPrefs } from '@/lib/queries/profile';
import { usePageTasks, useUpcomingTasks, type TaskWithPage } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { isReviewDue } from '@/lib/weekly-review';

/** Quantos itens cada seção mostra antes do "ver tudo". */
const PREVIEW = 8;

// Planejar (D258): tudo o que é "decidir quando" num lugar só. Antes o calendário só se achava
// rolando o Início no celular, a revisão semanal só pelo aviso dela, e os próximos dias, a Entrada
// sem data e as Atribuídas a mim eram seções do Início.
export default function PlanScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const narrow = useWindowDimensions().width < 768;
  const upcoming = useUpcomingTasks(today, addDays(today, 7));
  const inbox = usePageTasks(tree.data?.inbox?.id);
  const inProject = !!tree.data?.folders.some((f) => f.is_shared);
  const mine = useMyTasks({ enabled: inProject });
  const reviewDue = isReviewDue(useUiPrefs().review, today);

  // Da Entrada, só o que ainda não tem data (o que tem já aparece nos próximos dias ou na Hoje)
  const inboxOpen = (inbox.data ?? []).filter(
    (task) => !task.parent_task_id && task.status !== 'done' && !task.due_date,
  );
  const assigned = inProject ? (mine.data ?? []) : [];
  const labelOf = (task: TaskWithPage) => (task.page ? pageLabel(task.page) : undefined);

  // Abas montadas atrás da ativa: fora de foco não desenha as listas
  const focused = useIsFocused();
  if (!focused) return <Screen size="medium">{null}</Screen>;

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          search
          help="calendario"
          eyebrow={t('plan.eyebrow')}
          title={t('nav.plan')}
          right={
            narrow && (
              <>
                <NotificationsBell />
              </>
            )
          }
        />
        <HubSection>
          <HubRow
            icon={CalendarDays}
            label={t('nav.calendar')}
            hint={t('plan.calendarHint')}
            href="/calendario"
          />
          <HubRow
            icon={ClipboardCheck}
            label={t('review.title')}
            hint={t('plan.reviewHint')}
            href="/revisao"
            badge={reviewDue ? t('plan.reviewDue') : null}
          />
          {inProject && (
            <HubRow
              icon={UserCheck}
              label={t('nav.mine')}
              hint={t('plan.mineHint')}
              href="/mine"
              badge={assigned.length || null}
            />
          )}
        </HubSection>
        <Section
          title={t('home.upcoming')}
          count={(upcoming.data ?? []).length}
          link={{ href: '/calendario', label: t('home.openCalendar') }}
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
          link={{ href: '/inbox', label: t('plan.openInbox') }}
          empty={inboxOpen.length === 0 ? t('home.inboxEmpty') : undefined}
        >
          {inboxOpen.slice(0, PREVIEW).map((task) => (
            <TaskRow key={task.id} task={task} today={today} />
          ))}
          <More count={inboxOpen.length} />
        </Section>
      </ScreenScroll>
    </Screen>
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
  count?: number;
  link: { href: Href; label: string };
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <View>
      <SectionLabel
        title={title}
        count={count || undefined}
        right={
          <Link href={link.href} asChild>
            <Pressable
              accessibilityRole="link"
              className="-mr-2 min-h-8 justify-center rounded px-2 hover:bg-wash active:bg-wash"
            >
              <Text className="text-xs font-semibold text-ink">{link.label}</Text>
            </Pressable>
          </Link>
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
