import { Timer as TimerIcon, Watch, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useLiveTimer, usePomodoro, useStartTimer } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatDueDate, todayIn } from '@/lib/parser/dates';
import { estimatedPomodoros } from '@/lib/pomodoro';
import { useTaskTime, useTimeEntryActions, type TimeEntry } from '@/lib/queries/pomodoro';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import type { Task } from '@/lib/queries/tasks';
import { formatDuration } from '@/lib/task-tree';
import { parseTimeInput } from '@/lib/time';
import { formatClock } from '@/lib/timers';
import { uuidv7 } from '@/lib/uuid';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

// Tempo da tarefa no painel (K, D129/D131): pomodoro, cronômetro, o feito × estimado, lançar à
// mão e os últimos registros. Mãe com filhas mostra só a soma (o tempo é das folhas).

const SHOWN = 5;

export function TaskTime({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { t } = useTranslation();
  const today = useToday();
  const toast = useToast();
  const pomodoro = usePomodoro();
  const startTimer = useStartTimer();
  const live = useLiveTimer();
  const entries = useTaskTime(task.id);
  const actions = useTimeEntryActions();
  const userId = useSession().session?.user.id;
  const [text, setText] = useState('');

  const list = entries.data ?? [];
  const pomodoros = list.filter((e) => e.source === 'pomodoro').length;
  const estimated = estimatedPomodoros(task.estimate_minutes, pomodoro.settings.focus_minutes);
  const stopwatch =
    live.timer?.kind === 'stopwatch' && live.timer.task_id === task.id ? live.timer : null;

  function log() {
    const parsed = parseTimeInput(text, today);
    if (!parsed) {
      toast({ message: t('time.invalid') });
      return;
    }
    actions.log.mutate(
      { id: uuidv7(), taskId: task.id, ...parsed },
      { onError: (err) => toast({ message: err.message }) },
    );
    setText('');
  }

  return (
    <View className="gap-3">
      <Text className="text-sm text-ink">
        {task.estimate_minutes
          ? t('time.doneOf', {
              done: formatDuration(task.actual_minutes),
              estimate: formatDuration(task.estimate_minutes),
            })
          : t('time.done', { done: formatDuration(task.actual_minutes) })}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          icon={TimerIcon}
          label={t('pomodoro.start')}
          disabled={disabled}
          onPress={() => pomodoro.start({ id: task.id, title: task.title })}
        />
        {stopwatch ? (
          <Button
            variant="ghost"
            icon={Watch}
            label={t('time.stopStopwatch', { time: formatClock(live.seconds) })}
            onPress={() => live.act('done')}
          />
        ) : (
          <Button
            variant="ghost"
            icon={Watch}
            label={t('time.startStopwatch')}
            disabled={disabled}
            onPress={() =>
              startTimer({ kind: 'stopwatch', taskId: task.id, config: { label: task.title } })
            }
          />
        )}
        <Text className="font-mono text-xs text-ink-muted">
          {estimated
            ? t('pomodoro.countOf', { done: pomodoros, estimated })
            : t('pomodoro.count', { done: pomodoros })}
        </Text>
      </View>
      {!disabled && (
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            value={text}
            onChangeText={setText}
            onSubmitEditing={log}
            submitBehavior="submit"
            placeholder={t('time.placeholder')}
            accessibilityLabel={t('time.logField')}
            maxLength={40}
          />
          <Button label={t('time.log')} disabled={!text.trim()} onPress={log} />
        </View>
      )}
      {list.length > 0 && (
        <View accessibilityRole="list">
          {list.slice(0, SHOWN).map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              today={today}
              mine={entry.user_id === userId}
              onRemove={() =>
                actions.remove.mutate(entry, {
                  onError: (err) => toast({ message: err.message }),
                })
              }
            />
          ))}
          {list.length > SHOWN && (
            <Text className="pt-1 font-mono text-xs text-ink-muted">
              {t('time.more', { count: list.length - SHOWN })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function EntryRow({
  entry,
  today,
  mine,
  onRemove,
}: {
  entry: TimeEntry;
  today: string;
  mine: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const day = todayIn(useTimeZone(), new Date(entry.ended_at));
  const source = t(
    entry.source === 'pomodoro'
      ? 'time.sourcePomodoro'
      : entry.source === 'stopwatch'
        ? 'time.sourceStopwatch'
        : 'time.sourceManual',
  );
  const text = `${formatDuration(entry.minutes)} · ${source} · ${formatDueDate(day, today)}`;
  return (
    <View className="min-h-11 flex-row items-center gap-2 border-b border-line">
      <Text className="flex-1 font-mono text-xs text-ink" accessibilityLabel={text}>
        {text}
      </Text>
      {mine && (
        <IconButton
          tone="danger"
          icon={X}
          label={t('time.remove', { entry: text })}
          onPress={onRemove}
        />
      )}
    </View>
  );
}
