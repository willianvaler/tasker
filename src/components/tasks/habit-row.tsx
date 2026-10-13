import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
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
 * + e − dos hábitos contador e bom/ruim (D63), com aviso da recompensa. No bom/ruim o aviso tem
 * "Desfazer" (o + e o − são registros, não o contrário um do outro); no contador o − já desfaz.
 */
export function useHabitTickWithToast() {
  const tick = useHabitTick();
  const undo = useUndoHabitTick();
  const toast = useToast();
  const game = useGameState();
  return (task: Task, delta: 1 | -1) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const vars: HabitTickVars = { taskId: task.id, delta, id: randomUUID() };
    const plusminus = task.habit_kind === 'plusminus';
    const message = plusminus
      ? delta === 1
        ? `👍 ${task.title}`
        : `👎 ${task.title}`
      : `${task.title}: ${Math.max(0, Math.min(task.habit_target ?? 1, task.count_up + delta))}/${task.habit_target ?? 1}`;
    const action = plusminus ? { label: 'Desfazer', onPress: () => undo.mutate(vars) } : undefined;
    if (plusminus) toast({ message, action });
    tick.mutate(vars, {
      onSuccess: (summary) => {
        const reward = summary && game.data?.enabled !== false ? rewardMessage(summary) : null;
        if (reward) toast({ message: `${message} · ${reward}`, action });
      },
    });
  };
}

/** Botão redondo de + / − (alvo de toque de 44px). */
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
        'h-11 w-11 items-center justify-center rounded-full border active:opacity-70',
        sign === '+'
          ? 'border-ok bg-ok/10'
          : 'border-danger bg-danger/10',
        disabled && 'opacity-40',
      )}
    >
      <Text
        className={cn(
          'text-xl font-bold',
          sign === '+' ? 'text-ok' : 'text-danger',
        )}
      >
        {sign}
      </Text>
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
    <View className="min-h-16 flex-row items-center border-b border-line bg-paper">
      {draggable && <DragHandle label={task.title} taskId={task.id} />}
      {kind === 'check' && (
        <Checkbox
          checked={done}
          disabled={!writable}
          label={done ? `Desmarcar ${task.title}` : `Feito: ${task.title}`}
          onChange={(checked) => toggle(task, checked)}
        />
      )}
      {kind === 'plusminus' && (
        <View className="px-1">
          <TickButton
            sign="+"
            label={`Hábito bom: ${task.title}`}
            disabled={!writable}
            onPress={() => tick(task, 1)}
          />
        </View>
      )}
      {kind === 'counter' && (
        <View className="flex-row items-center gap-1 px-1">
          <TickButton
            sign="−"
            label={`Menos um: ${task.title}`}
            disabled={!writable || task.count_up === 0}
            onPress={() => tick(task, -1)}
          />
          <Text
            className={cn(
              'min-w-12 text-center text-sm font-bold',
              done ? 'text-accent' : 'text-ink',
            )}
            accessibilityLabel={`${task.count_up} de ${target}`}
            accessibilityLiveRegion="polite"
          >
            {task.count_up}/{target}
          </Text>
          <TickButton
            sign="+"
            label={`Mais um: ${task.title}`}
            disabled={!writable || task.count_up >= target}
            onPress={() => tick(task, 1)}
          />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${task.title}`}
        className="flex-1 gap-1 py-2"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text className={cn('text-base', done ? 'text-ink-muted' : 'text-ink')}>
          {task.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-3">
          <Text className="text-xs text-ink-muted">
            {kind === 'plusminus' ? 'Bom e ruim' : recurrenceLabel(r) || 'Todo dia'}
          </Text>
          {pageLabel && <Text className="text-xs text-ink-muted">{pageLabel}</Text>}
        </View>
      </Pressable>
      {kind === 'plusminus' ? (
        <View className="flex-row items-center gap-2 pr-1">
          <Text
            className="text-right text-xs text-ink-muted"
            accessibilityLabel={`Hoje: ${task.count_up} bons, ${task.count_down} ruins`}
          >
            <Text className="font-bold text-ok">
              +{task.count_up}
            </Text>
            {'  '}
            <Text className="font-bold text-danger">−{task.count_down}</Text>
          </Text>
          <TickButton
            sign="−"
            label={`Hábito ruim: ${task.title}`}
            disabled={!writable}
            onPress={() => tick(task, -1)}
          />
        </View>
      ) : (
        <View className="items-end gap-1 pr-2">
          <Text
            className={cn(
              'text-sm font-bold',
              streak > 0 ? 'text-warn' : 'text-ink-muted',
            )}
            accessibilityLabel={`Sequência de ${streak}`}
          >
            🔥 {streak}
          </Text>
          <View className="flex-row gap-1" accessibilityLabel="Últimos 7 dias">
            {week.map((day) => (
              <View
                key={day}
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
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
