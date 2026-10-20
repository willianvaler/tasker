import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TaskRow } from '@/components/tasks/task-row';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { addDays } from '@/lib/parser/dates';
import { useToday, useUpdateUiPrefs } from '@/lib/queries/profile';
import { useStaleTasks, useWeekDone } from '@/lib/queries/review';
import {
  useDeleteTask,
  useTodayTasks,
  useUpcomingTasks,
  useUpdateTask,
  type TaskWithPage,
} from '@/lib/queries/tasks';
import { pageLabel } from '@/lib/queries/tree';
import { snoozeDate } from '@/lib/snooze';
import { distinctTasks, donePerPage, reviewSince, staleBefore } from '@/lib/weekly-review';
import { useToast } from '@/providers/toast';
import { useTaskCan } from '@/providers/write';

const STEPS = ['done', 'left', 'stale', 'next'] as const;
type Step = (typeof STEPS)[number];

/** Revisão semanal guiada (PB3, D223): concluí → ficou → parado → próxima semana. */
export default function WeeklyReviewScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const toast = useToast();
  const [step, setStep] = useState<Step>('done');
  const savePrefs = useUpdateUiPrefs();

  const index = STEPS.indexOf(step);
  const last = index === STEPS.length - 1;

  function finish() {
    savePrefs.mutate({ review: { done: today } });
    toast({ message: t('review.finished') });
    router.back();
  }

  return (
    <Screen size="medium">
      <ScreenHeader title={t('review.title')} help="organizar-o-dia" back />
      <ScreenScroll contentContainerClassName="gap-4 pb-12">
        <Tabs
          label={t('review.steps')}
          value={step}
          onChange={setStep}
          tabs={STEPS.map((s, i) => ({ value: s, label: `${i + 1}. ${t(`review.${s}Tab`)}` }))}
        />
        {step === 'done' && <DoneStep since={reviewSince(today)} />}
        {step === 'left' && <LeftStep today={today} />}
        {step === 'stale' && <StaleStep today={today} />}
        {step === 'next' && <NextStep today={today} />}
        <View className="flex-row justify-between gap-2 pt-2">
          {index > 0 ? (
            <Button
              variant="ghost"
              label={t('review.back')}
              onPress={() => setStep(STEPS[index - 1])}
            />
          ) : (
            <View />
          )}
          {last ? (
            <Button label={t('review.finish')} onPress={finish} />
          ) : (
            <Button label={t('review.next')} onPress={() => setStep(STEPS[index + 1])} />
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function DoneStep({ since }: { since: string }) {
  const { t } = useTranslation();
  const done = useWeekDone(since);
  const all = done.data ?? [];
  const habits = all.filter((d) => d.view_type === 'habits').length;
  const tasks = all.filter((d) => d.view_type !== 'habits');
  const perPage = donePerPage(tasks);
  const rows = distinctTasks(tasks);

  return (
    <View className="gap-3">
      <Text className="text-sm text-ink-muted">{t('review.doneIntro')}</Text>
      {!done.isPending && (
        <Text className="text-lg font-semibold text-ink" role="status">
          {t('review.doneCount', { count: tasks.length })}
          {habits > 0 ? ` · ${t('review.habitsCount', { count: habits })}` : ''}
        </Text>
      )}
      {perPage.length > 1 && (
        <View className="flex-row flex-wrap gap-2">
          {perPage.map((p) => (
            <Text key={p.page} className="rounded bg-wash px-2 py-1 text-xs text-ink">
              {`${p.page || t('review.noPage')} · ${p.count}`}
            </Text>
          ))}
        </View>
      )}
      {rows.map((r) => (
        <Text key={r.task_id} className="text-sm text-ink">
          {`✓ ${r.title}${r.times > 1 ? ` ×${r.times}` : ''}`}
        </Text>
      ))}
      {!done.isPending && tasks.length === 0 && <EmptyState title={t('review.doneEmpty')} />}
    </View>
  );
}

function LeftStep({ today }: { today: string }) {
  const { t } = useTranslation();
  const open = useTodayTasks(today);
  const overdue = (open.data ?? []).filter((task) => task.due_date && task.due_date < today);
  return (
    <View className="gap-1">
      <Text className="text-sm text-ink-muted">{t('review.leftIntro')}</Text>
      <SectionLabel title={t('review.overdue')} count={overdue.length} />
      {overdue.map((task) => (
        <ReviewRow key={task.id} task={task} today={today}>
          <DateActions task={task} today={today} />
        </ReviewRow>
      ))}
      {!open.isPending && overdue.length === 0 && <EmptyState title={t('review.leftEmpty')} />}
    </View>
  );
}

function StaleStep({ today }: { today: string }) {
  const { t } = useTranslation();
  const stale = useStaleTasks(staleBefore(today));
  const items = stale.data ?? [];
  return (
    <View className="gap-1">
      <Text className="text-sm text-ink-muted">{t('review.staleIntro')}</Text>
      <SectionLabel title={t('review.stale')} count={items.length} />
      {items.map((task) => (
        <ReviewRow key={task.id} task={task} today={today}>
          <StaleActions task={task} today={today} />
        </ReviewRow>
      ))}
      {!stale.isPending && items.length === 0 && <EmptyState title={t('review.staleEmpty')} />}
    </View>
  );
}

function NextStep({ today }: { today: string }) {
  const { t } = useTranslation();
  const upcoming = useUpcomingTasks(today, addDays(today, 7));
  const items = upcoming.data ?? [];
  return (
    <View className="gap-1">
      <Text className="text-sm text-ink-muted">{t('review.nextIntro')}</Text>
      <SectionLabel title={t('review.upcoming')} count={items.length} />
      {items.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          pageLabel={task.page ? pageLabel(task.page) : undefined}
        />
      ))}
      {!upcoming.isPending && items.length === 0 && (
        <EmptyState title={t('review.upcomingEmpty')} />
      )}
    </View>
  );
}

function ReviewRow({
  task,
  today,
  children,
}: {
  task: TaskWithPage;
  today: string;
  children: React.ReactNode;
}) {
  return (
    <View className="border-b border-line pb-2">
      <TaskRow task={task} today={today} pageLabel={task.page ? pageLabel(task.page) : undefined} />
      {children}
    </View>
  );
}

function DateActions({ task, today }: { task: TaskWithPage; today: string }) {
  const { t } = useTranslation();
  const can = useTaskCan(task);
  const update = useUpdateTask();
  if (!can.edit) return null;
  const set = (due_date: string | null) => update.mutate({ id: task.id, patch: { due_date } });
  return (
    <View
      className="flex-row flex-wrap gap-2 pl-8"
      aria-label={t('review.moveTo', { title: task.title })}
    >
      <Chip label={t('review.today')} onPress={() => set(today)} />
      <Chip label={t('review.tomorrow')} onPress={() => set(snoozeDate('tomorrow', today))} />
      <Chip label={t('review.nextWeek')} onPress={() => set(snoozeDate('nextWeek', today))} />
      <Chip label={t('review.noDate')} onPress={() => set(null)} />
    </View>
  );
}

function StaleActions({ task, today }: { task: TaskWithPage; today: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const can = useTaskCan(task);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  if (!can.edit && !can.delete) return null;
  return (
    <View
      className="flex-row flex-wrap gap-2 pl-8"
      aria-label={t('review.decide', { title: task.title })}
    >
      {can.edit && (
        <>
          <Chip
            label={t('review.tomorrow')}
            onPress={() =>
              update.mutate({ id: task.id, patch: { due_date: snoozeDate('tomorrow', today) } })
            }
          />
          <Chip
            label={t('review.nextWeek')}
            onPress={() =>
              update.mutate({ id: task.id, patch: { due_date: snoozeDate('nextWeek', today) } })
            }
          />
        </>
      )}
      {can.delete && (
        <Chip
          label={t('review.archive')}
          onPress={() =>
            remove.mutateAsync(task.id).then(
              () => toast({ message: t('review.archived', { title: task.title }) }),
              () => {},
            )
          }
        />
      )}
    </View>
  );
}
