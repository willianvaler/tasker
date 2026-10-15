import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SendPageDialog } from '@/components/send-page';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatDueDate, todayIn } from '@/lib/parser/dates';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import {
  usePageStudents,
  useStudentActions,
  useStudentHistory,
  type Student,
} from '@/lib/queries/shares';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { daysSince, historyByCycle, loadEvolution } from '@/lib/students';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Painel "Alunos" (L5, D137): quem recebe a página, como está cada um e o histórico do escolhido.
// Precisa de conexão (os números vêm do servidor).

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
      <ScrollView contentContainerClassName="gap-6 pb-clear">
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
                <StudentDetail pageId={page.id} student={current} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {archiving && (
        <ConfirmDialog
          title={t('students.archiveTitle', { name: archiving.name })}
          message={t('students.archiveMessage')}
          confirmLabel={t('students.archive')}
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
  student,
  active,
  onOpen,
  onRemind,
  onArchive,
  disabled,
}: {
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
  const summary = [
    t('students.thisCycle', { done: student.done_now, total: student.items }),
    student.expected != null
      ? t('students.adherence', { done: student.sessions, expected: student.expected })
      : null,
    days == null ? t('students.never') : t('students.lastActivity', { count: days }),
    student.notes_recent ? t('students.notes', { count: student.notes_recent }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View className={cn('gap-1 border-b border-line py-2', active && 'bg-wash')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${student.name}: ${summary}`}
        aria-selected={active}
        onPress={onOpen}
        className="gap-1 rounded px-2 hover:bg-wash"
      >
        <Text className="text-base font-semibold text-ink">{student.name}</Text>
        <Text className="font-mono text-xs text-ink-muted">{summary}</Text>
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

function StudentDetail({ pageId, student }: { pageId: string; student: Student }) {
  const { t } = useTranslation();
  const today = useToday();
  const tz = useTimeZone();
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
