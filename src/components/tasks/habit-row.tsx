import * as Haptics from 'expo-haptics';
import { uuidv7 } from '@/lib/uuid';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { addDays, type IsoDate } from '@/lib/parser/dates';
import { useGameState } from '@/lib/queries/game';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import {
  useCompletionDates,
  useHabitTick,
  useUndoHabitTick,
  type HabitTickVars,
  type Task,
} from '@/lib/queries/tasks';
import { useToast } from '@/providers/toast';
import {
  asRecurrence,
  habitPeriodKey,
  habitStreak,
  isHabitDueOn,
  recurrenceLabel,
} from '@/lib/recurrence';
import { useCanWrite } from '@/providers/write';
import { DragHandle } from './sortable-tasks';
import { useToggleWithUndo } from './task-row';

const HISTORY_DAYS = 400;

/**
 * Datas em que cada hábito foi feito (histórico do banco), já com a marcação atual aplicada:
 * marcar/desmarcar agora atualiza a sequência na hora, sem esperar o servidor.
 */
export function useHabitDates(tasks: Task[]) {
  const today = useToday();
  const timeZone = useTimeZone();
  const since = `${addDays(today, -HISTORY_DAYS)}T00:00:00Z`;
  const completions = useCompletionDates(
    tasks.map((t) => t.id),
    since,
    timeZone,
  );

  const datesOf = (task: Task): IsoDate[] => {
    const r = asRecurrence(task.recurrence);
    const current = habitPeriodKey(r, today);
    const history = (completions.data?.[task.id] ?? []).filter(
      (d) => habitPeriodKey(r, d) !== current,
    );
    // O período atual vem do status (que já tem a atualização otimista)
    return task.status === 'done' ? [...history, today] : history;
  };
  return { datesOf, today };
}

/**
 * + e − dos hábitos contador e bom/ruim, com aviso da recompensa. No bom/ruim o aviso tem
 * "Desfazer" (o + e o − são registros, não o contrário um do outro); no contador o − já desfaz.
 */
export function useHabitTickWithToast() {
  const tick = useHabitTick();
  const undo = useUndoHabitTick();
  const toast = useToast();
  const game = useGameState();
  const { t } = useTranslation();
  return (task: Task, delta: 1 | -1) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const vars: HabitTickVars = { taskId: task.id, delta, id: uuidv7() };
    const plusminus = task.habit_kind === 'plusminus';
    const message = plusminus
      ? delta === 1
        ? `👍 ${task.title}`
        : `👎 ${task.title}`
      : `${task.title}: ${Math.max(0, Math.min(task.habit_target ?? 1, task.count_up + delta))}/${task.habit_target ?? 1}`;
    const action = plusminus
      ? { label: t('common.undo'), onPress: () => undo.mutate(vars) }
      : undefined;
    const key = `habit:${task.id}`;
    if (plusminus) toast({ message, action, key });
    // mutateAsync: a recompensa chega mesmo se a linha sair da tela antes (ver useToggleWithUndo)
    tick.mutateAsync(vars).then(
      (summary) => {
        const reward = summary && game.data?.enabled !== false ? rewardMessage(summary) : null;
        // Contador: o aviso nasce com a recompensa; bom/ruim: atualiza o que já está na tela
        if (reward) toast({ message: `${message} · ${reward}`, action, key, update: plusminus });
      },
      () => {},
    );
  };
}

/** Botão quadrado de + / − (44 px no celular, 32 no computador). */
function TickButton({
  sign,
  label,
  disabled,
  onPress,
}: {
  sign: '+' | '−';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded border border-line hover:bg-wash active:bg-wash md:h-8 md:w-8',
        disabled && 'opacity-40',
      )}
    >
      <Icon icon={sign === '+' ? Plus : Minus} tone={sign === '+' ? 'ok' : 'danger'} />
    </Pressable>
  );
}

export function HabitRow({
  task,
  dates,
  today,
  draggable,
  pageLabel,
}: {
  task: Task;
  dates: IsoDate[];
  today: IsoDate;
  draggable?: boolean;
  pageLabel?: string;
}) {
  const { t } = useTranslation();
  const writable = useCanWrite(task.folder_id, { offline: true });
  const toggle = useToggleWithUndo();
  const tick = useHabitTickWithToast();
  const r = asRecurrence(task.recurrence);
  const done = task.status === 'done';
  const kind = task.habit_kind;
  const target = task.habit_target ?? 1;
  const streak = habitStreak(r, dates, today);
  const doneSet = new Set(dates);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <View className="min-h-[52px] flex-row items-center border-b border-line md:min-h-10">
      {draggable && <DragHandle label={task.title} taskId={task.id} />}
      {kind === 'check' && (
        <Checkbox
          checked={done}
          disabled={!writable}
          label={t(done ? 'habit.uncheck' : 'habit.check', { title: task.title })}
          onChange={(checked) => toggle(task, checked)}
        />
      )}
      {kind !== 'check' && <View className="w-3" />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('task.details', { title: task.title })}
        className="flex-1 justify-center gap-1 py-1 md:flex-row md:items-center md:gap-3"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text className={cn('text-base md:text-sm', done ? 'text-ink-muted' : 'text-ink')}>
          {task.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-3 md:ml-auto md:pr-4">
          <Text className="font-mono text-xs text-ink-muted">
            {kind === 'plusminus' ? t('habit.plusminus') : recurrenceLabel(r) || t('habit.daily')}
          </Text>
          {pageLabel && <Text className="font-mono text-xs text-ink-muted">{pageLabel}</Text>}
        </View>
      </Pressable>
      {kind === 'plusminus' ? (
        <View className="flex-row items-center gap-2 pl-2 pr-1">
          <Text
            className="text-right font-mono text-xs text-ink-muted"
            accessibilityLabel={t('habit.todayCounts', {
              up: task.count_up,
              down: task.count_down,
            })}
          >
            <Text className="font-mono text-ok">+{task.count_up}</Text>
            {'  '}
            <Text className="font-mono text-danger">−{task.count_down}</Text>
          </Text>
          {/* − à esquerda do +, os dois na direita (como no Habitica) */}
          <TickButton
            sign="−"
            label={t('habit.bad', { title: task.title })}
            disabled={!writable}
            onPress={() => tick(task, -1)}
          />
          <TickButton
            sign="+"
            label={t('habit.good', { title: task.title })}
            disabled={!writable}
            onPress={() => tick(task, 1)}
          />
        </View>
      ) : kind === 'counter' ? (
        <View className="flex-row items-center gap-2 pl-2 pr-1">
          <Text
            className={cn('font-mono text-xs', streak > 0 ? 'text-ink' : 'text-ink-muted')}
            accessibilityLabel={t('habit.streak', { count: streak })}
          >
            {t('habit.streakShort', { count: streak })}
          </Text>
          <Text
            className={cn('min-w-10 text-right font-mono text-xs', done ? 'text-accent' : 'text-ink')}
            accessibilityLabel={t('habit.progress', { count: task.count_up, target })}
            accessibilityLiveRegion="polite"
          >
            {task.count_up}/{target}
          </Text>
          <TickButton
            sign="−"
            label={t('habit.less', { title: task.title })}
            disabled={!writable || task.count_up === 0}
            onPress={() => tick(task, -1)}
          />
          <TickButton
            sign="+"
            label={t('habit.more', { title: task.title })}
            disabled={!writable || task.count_up >= target}
            onPress={() => tick(task, 1)}
          />
        </View>
      ) : (
        <View className="items-end gap-1 pr-2 md:flex-row-reverse md:items-center md:gap-3">
          <Text
            className={cn('font-mono text-xs', streak > 0 ? 'text-ink' : 'text-ink-muted')}
            accessibilityLabel={t('habit.streak', { count: streak })}
          >
            {t('habit.streakShort', { count: streak })}
          </Text>
          <View className="flex-row gap-1" accessibilityLabel={t('habit.last7')}>
            {week.map((day) => (
              <View
                key={day}
                className={cn(
                  'h-2 w-2 rounded-full',
                  doneSet.has(day)
                    ? 'bg-accent'
                    : isHabitDueOn(r, day)
                      ? 'border border-ink-muted'
                      : 'bg-wash',
                )}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
