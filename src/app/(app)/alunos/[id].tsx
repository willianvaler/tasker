import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SendPageDialog } from '@/components/send-page';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { coachSummary, planAdherence, type CoachSummary } from '@/lib/gym/coach';
import {
  DEFAULT_RULE,
  PROGRESSION_RULES,
  readCoachPlan,
  type ProgressionRule,
} from '@/lib/gym/progression';
import { formatWeight } from '@/lib/gym/units';
import { formatDueDate, formatShortDate, todayIn } from '@/lib/parser/dates';
import { useGymPrefs, useTimeZone, useToday } from '@/lib/queries/profile';
import {
  usePageShares,
  usePageStudents,
  useStudentActions,
  useStudentHistory,
  useStudentSets,
  type Student,
} from '@/lib/queries/shares';
import { usePageTasks } from '@/lib/queries/tasks';
import { pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { daysSince, historyByCycle, loadEvolution } from '@/lib/students';
import type { TaskMeta } from '@/lib/parser/quick';
import { parseWeight } from '@/lib/workout';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Painel "Alunos" (L5, D137): quem recebe a página, como está cada um e o histórico do escolhido.
// Com o painel do treinador (AC13, D278): recordes, 1RM, volume, exercícios parados e aderência
// ao plano da semana, do diário do aluno nesta página. Precisa de conexão (vem do servidor).

/** O resumo de treino do aluno nesta página (o mesmo cache na linha e no detalhe) */
function useCoach(pageId: string, userId: string | null) {
  const sets = useStudentSets(pageId, userId);
  const tz = useTimeZone();
  const today = useToday();
  return sets.data ? coachSummary(sets.data, tz, today) : null;
}

export default function StudentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const tree = useTree();
  const page = tree.data?.pages.find((p) => p.id === id);
  const students = usePageStudents(id);
  const actions = useStudentActions(id);
  const toast = useToast();
  const online = useIsOnline();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [selected, setSelected] = useState<string | null>(null);
  const [archiving, setArchiving, closeArchive] = useDialog<Student>();
  const [sending, setSending, closeSending] = useDialog<true>();
  const list = students.data ?? [];
  const current = list.find((s) => s.share_id === selected) ?? (wide ? list[0] : undefined);
  const onError = (err: Error) => toast({ message: err.message });

  return (
    <Screen size="wide">
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          help="enviar-pagina"
          title={t('students.title')}
          eyebrow={page ? pageLabel(page) : undefined}
          back
          right={
            page && (
              <Button
                variant="ghost"
                label={t('students.sendMore')}
                disabled={!online}
                onPress={() => setSending(true)}
              />
            )
          }
        />
        {students.isPending ? null : list.length === 0 ? (
          <EmptyState title={t('students.empty')} />
        ) : (
          <View className={cn('gap-8', wide && 'flex-row items-start')}>
            <View className={cn('gap-1', wide && 'w-[420px]')} accessibilityRole="list">
              {list.map((student) => (
                <StudentRow
                  key={student.share_id}
                  pageId={id}
                  trainDays={page?.train_days}
                  student={student}
                  active={current?.share_id === student.share_id}
                  onOpen={() => setSelected(student.share_id)}
                  onRemind={() =>
                    actions.remind.mutate(student.share_id, {
                      onError,
                      onSuccess: () =>
                        toast({ message: t('students.reminded', { name: student.name }) }),
                    })
                  }
                  onArchive={() => setArchiving(student)}
                  disabled={!online}
                />
              ))}
            </View>
            {current && page && (
              <View className="flex-1">
                <StudentDetail page={page} student={current} />
              </View>
            )}
          </View>
        )}
      </ScreenScroll>
      {archiving && (
        <ConfirmDialog
          title={t('students.archiveTitle', { name: archiving.name })}
          message={t('students.archiveMessage')}
          confirmLabel={t('students.archive')}
          destructive
          onClose={closeArchive}
          onConfirm={() => {
            actions.archive.mutate(archiving.share_id, { onError });
            closeArchive();
          }}
        />
      )}
      {sending && page && <SendPageDialog page={page} onClose={closeSending} />}
    </Screen>
  );
}

function StudentRow({
  pageId,
  trainDays,
  student,
  active,
  onOpen,
  onRemind,
  onArchive,
  disabled,
}: {
  pageId: string;
  trainDays: number[] | null | undefined;
  student: Student;
  active: boolean;
  onOpen: () => void;
  onRemind: () => void;
  onArchive: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const days = daysSince(student.last_activity, now);
  const remindedToday = daysSince(student.last_reminded_at, now) === 0;
  const today = useToday();
  const coach = useCoach(pageId, student.recipient_id);
  const stalled = coach?.exercises.filter((e) => e.stagnation).length ?? 0;
  const plan = coach ? planAdherence(coach.days, trainDays, today) : null;
  const summary = [
    t('students.thisCycle', { done: student.done_now, total: student.items }),
    plan
      ? t('students.coachPlan', plan)
      : student.expected != null
        ? t('students.adherence', { done: student.sessions, expected: student.expected })
        : null,
    days == null ? t('students.never') : t('students.lastActivity', { count: days }),
    student.notes_recent ? t('students.notes', { count: student.notes_recent }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View className={cn('gap-1 border-b border-line px-2 py-2', active && 'bg-wash')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${student.name}: ${summary}`}
        aria-selected={active}
        onPress={onOpen}
        className="gap-1 rounded px-2 hover:bg-wash"
      >
        <Text className="text-base font-semibold text-ink">{student.name}</Text>
        <Text className="font-mono text-xs text-ink-muted">{summary}</Text>
        {stalled > 0 && (
          <Text className="font-mono text-xs text-warn">
            {t('students.stalled', { count: stalled })}
          </Text>
        )}
      </Pressable>
      <View className="flex-row gap-1">
        <Button
          variant="ghost"
          label={t(remindedToday ? 'students.remindedToday' : 'students.remind')}
          disabled={disabled || remindedToday}
          accessibilityLabel={t('students.remindLabel', { name: student.name })}
          onPress={onRemind}
        />
        <Button
          variant="ghost"
          label={t('students.archive')}
          disabled={disabled}
          accessibilityLabel={t('students.archiveLabel', { name: student.name })}
          onPress={onArchive}
        />
      </View>
    </View>
  );
}

function StudentDetail({ page, student }: { page: Page; student: Student }) {
  const pageId = page.id;
  const trainDays = page.train_days;
  const { t } = useTranslation();
  const today = useToday();
  const tz = useTimeZone();
  const coach = useCoach(pageId, student.recipient_id);
  const history = useStudentHistory(pageId, student.recipient_id);
  const checks = history.data ?? [];
  const groups = historyByCycle(checks);
  const loads = loadEvolution(checks);
  const day = (iso: string) => formatDueDate(todayIn(tz, new Date(iso)), today);

  return (
    <View className="gap-6">
      <Text className="text-lg font-semibold text-ink" accessibilityRole="header">
        {student.name}
      </Text>
      {coach && <CoachPanel coach={coach} trainDays={trainDays} />}
      <StudentPlan page={page} student={student} />
      {loads.length > 0 && (
        <View className="gap-2">
          <SectionLabel title={t('students.loads')} />
          {loads.map((row) => {
            const max = Math.max(...row.points.map((p) => p.value), 1);
            return (
              <View
                key={row.taskId}
                accessible
                accessibilityLabel={`${row.title}: ${row.points.map((p) => p.label).join(', ')}`}
                className="gap-1"
              >
                <Text className="text-sm text-ink">{row.title}</Text>
                <View className="h-12 flex-row items-end gap-1">
                  {row.points.map((p) => (
                    <View key={p.at} className="w-8 items-center">
                      <View
                        className="w-5 rounded-t bg-accent"
                        style={{ height: Math.max(4, Math.round((p.value / max) * 32)) }}
                      />
                    </View>
                  ))}
                </View>
                <Text className="font-mono text-xs text-ink-muted">
                  {row.points.map((p) => p.label).join(' → ')}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View className="gap-2">
        <SectionLabel title={t('students.history')} />
        {groups.length === 0 && (
          <Text className="text-sm text-ink-muted">{t('students.noHistory')}</Text>
        )}
        {groups.map((group) => (
          <View key={group.cycle} className="gap-1">
            <Text className="font-mono text-xs uppercase text-ink-muted">
              {t('students.cycleOf', { date: day(group.first) })}
            </Text>
            {group.items.map((item) => (
              <View key={item.id} className="min-h-9 justify-center border-b border-line">
                <Text className="text-sm text-ink">
                  {item.title}
                  {item.values?.length ? (
                    <Text className="font-mono text-xs text-ink-muted">
                      {'  '}
                      {item.values
                        .map((v) =>
                          [v.weight, v.reps ? `${v.reps}x` : null].filter(Boolean).join(' '),
                        )
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Text>
                {item.note && <Text className="text-sm text-warn">“{item.note}”</Text>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Painel do treinador (AC13): o resumo e um item por exercício, os parados primeiro. */
function CoachPanel({
  coach,
  trainDays,
}: {
  coach: CoachSummary;
  trainDays: number[] | null | undefined;
}) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const { unit } = useGymPrefs();
  const kg = (v: number) => formatWeight(v, unit, i18n.language);
  const plan = planAdherence(coach.days, trainDays, today);
  const best = (value: number, metric: string | null) =>
    metric === 'one_rm'
      ? kg(value)
      : metric === 'reps'
        ? t('workout.reps', { count: value })
        : metric === 'duration'
          ? t('diary.seconds', { count: value })
          : t('diary.km', {
              value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
                value / 1000,
              ),
            });
  const header = [
    t('students.coachRecords', { count: coach.records }),
    coach.recentVolumeKg > 0
      ? t('students.coachVolume', { volume: kg(coach.recentVolumeKg) })
      : null,
    plan ? t('students.coachPlan', plan) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View className="gap-2">
      <SectionLabel title={t('students.coach')} />
      {coach.exercises.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('students.noSets')}</Text>
      ) : (
        <>
          <Text className="font-mono text-xs text-ink-muted">{header}</Text>
          {coach.exercises.map((e) => {
            const details = [
              e.best1Rm
                ? t('students.best1Rm', {
                    oneRm: kg(e.best1Rm.oneRm),
                    weight: kg(e.best1Rm.weightKg),
                    reps: e.best1Rm.reps,
                  })
                : null,
              e.records ? t('students.coachRecords', { count: e.records }) : null,
              t('students.sessions', { count: e.sessions }),
              t('students.lastDay', { date: formatShortDate(e.lastDay) }),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View
                key={e.key}
                accessible
                accessibilityLabel={`${e.name}: ${details}`}
                className="min-h-9 justify-center gap-1 border-b border-line py-1"
              >
                <Text className="text-sm text-ink">{e.name}</Text>
                <Text className="font-mono text-xs text-ink-muted">{details}</Text>
                {e.stagnation && (
                  <Text className="text-sm text-warn">
                    {t('students.stalledLine', {
                      sessions: e.stagnation.sessions,
                      best: best(e.stagnation.best, e.metric),
                      date: formatShortDate(e.stagnation.since),
                    })}
                  </Text>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

/**
 * Plano deste aluno (AC13.2): para cada exercício da página, a regra de progressão e a carga
 * inicial que valem só para ele; vazio segue o da página. O aluno vê "definido pelo treinador".
 */
function StudentPlan({ page, student }: { page: Page; student: Student }) {
  const { t } = useTranslation();
  const tasks = usePageTasks(page.id);
  const shares = usePageShares(page.id);
  const actions = useStudentActions(page.id);
  const toast = useToast();
  const online = useIsOnline();
  const share = shares.data?.shares.find((s) => s.id === student.share_id);
  const all = tasks.data ?? [];
  const parents = new Set(all.map((task) => task.parent_task_id).filter(Boolean));
  const exercises = all.filter((task) => {
    const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
    return !parents.has(task.id) && (!!task.exercise_id || !!meta.weight || !!task.repeat_plan);
  });
  // O que está sendo digitado na carga de cada exercício (sem entrada: mostra a salva)
  const [typing, setTyping] = useState<Record<string, string>>({});
  if (!share || student.mode !== 'live' || exercises.length === 0) return null;
  const pageRule = (PROGRESSION_RULES as string[]).includes(page.progression ?? '')
    ? (page.progression as ProgressionRule)
    : DEFAULT_RULE;

  function save(taskId: string, patch: { progression?: string | null; weight?: string | null }) {
    if (!share) return;
    const current = readCoachPlan(share.coach_plan, taskId);
    actions.setPlan.mutate(
      {
        shareId: share.id,
        taskId,
        progression:
          patch.progression !== undefined ? patch.progression : (current?.progression ?? null),
        weight: patch.weight !== undefined ? patch.weight : (current?.weight ?? null),
      },
      {
        onSuccess: () => toast({ message: t('students.planSaved', { name: student.name }) }),
        onError: (err) => toast({ message: err.message }),
      },
    );
  }

  return (
    <View className="gap-2">
      <SectionLabel title={t('students.plan')} />
      <Text className="text-sm text-ink-muted">{t('students.planHint', { name: student.name })}</Text>
      {exercises.map((task) => {
        const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
        const entry = readCoachPlan(share.coach_plan, task.id);
        const own = (PROGRESSION_RULES as string[]).includes(task.progression ?? '')
          ? (task.progression as ProgressionRule)
          : null;
        const inherited = own ?? pageRule;
        const text = typing[task.id] ?? entry?.weight ?? '';
        return (
          <View key={task.id} className="gap-2 border-b border-line py-2">
            <Text className="text-sm text-ink">{task.title}</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('students.planRule', { title: task.title })}
              className="flex-row flex-wrap gap-1"
            >
              <Chip
                role="radio"
                label={t('progression.ruleInherit', { rule: t(`progression.rule_${inherited}`) })}
                selected={!entry?.progression}
                disabled={!online}
                onPress={() => save(task.id, { progression: null })}
              />
              {PROGRESSION_RULES.map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  label={t(`progression.rule_${r}`)}
                  selected={entry?.progression === r}
                  disabled={!online}
                  onPress={() => save(task.id, { progression: r })}
                />
              ))}
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-ink-muted">{t('students.planWeight')}</Text>
              <Input
                className="w-28"
                value={text}
                onChangeText={(v) => setTyping((prev) => ({ ...prev, [task.id]: v }))}
                placeholder={meta.weight ?? '—'}
                editable={online}
                accessibilityLabel={t('students.planWeightLabel', { title: task.title })}
                onBlur={() => {
                  const value = typing[task.id];
                  if (value == null) return;
                  setTyping(({ [task.id]: _, ...rest }) => rest);
                  const weight = value.trim() || null;
                  if (weight === (entry?.weight ?? null)) return;
                  if (weight && !parseWeight(weight)) {
                    toast({ message: t('students.planWeightInvalid') });
                    return;
                  }
                  save(task.id, { weight });
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
