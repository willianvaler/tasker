import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { AdjustButtons, useLiveTimer, useStartTimer } from '@/components/timer-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { useGameState } from '@/lib/queries/game';
import { useLogRep, useMyProgress } from '@/lib/queries/repeat';
import { useActiveTimer, useTimerActions } from '@/lib/queries/timers';
import type { Task } from '@/lib/queries/tasks';
import {
  DEFAULT_REST_SECONDS,
  effectiveReps,
  readRepeatPlan,
  REPEAT_MODES,
  restAfterRep,
  type RepeatMode,
  type RepeatPlan,
} from '@/lib/repeat';
import { formatClock } from '@/lib/timers';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';

// Repetições da tarefa (J1, D123): o plano (quantas, descanso) e o "Feita" que conta uma série.

const MODE_LABEL = {
  sets: 'repeat.modeSets',
  count: 'repeat.modeCount',
  timed: 'repeat.modeTimed',
  interval: 'repeat.modeInterval',
} as const satisfies Record<RepeatMode, string>;

/** Séries que contam agora para a tarefa (do usuário). */
export function useReps(task: Task) {
  const progress = useMyProgress();
  const plan = readRepeatPlan(task.repeat_plan);
  if (!plan) return null;
  return { plan, reps: effectiveReps(plan, task.status === 'done', progress.data?.[task.id]) };
}

/** Última conta calculada por tarefa (o otimista do TanStack só entra depois de um await). */
const lastCount = new Map<string, { reps: number; at: number }>();

/**
 * Uma série (+1) ou desfazer (−1), sem aviso: conta, guarda os valores da série e, nas séries,
 * começa o descanso (J3); desfazer cancela o descanso desta tarefa. O Modo Treino usa direto.
 */
export function useLogSet() {
  const log = useLogRep();
  const startTimer = useStartTimer();
  const timers = useTimerActions();
  const active = useActiveTimer().data;

  const cancelRest = (task: Task) => {
    if (active?.kind === 'rest' && active.task_id === task.id)
      timers.act(active, 'cancel').catch(() => {});
  };

  const logSet = (
    task: Task,
    plan: RepeatPlan,
    reps: number,
    delta: 1 | -1,
    values?: Record<string, unknown>,
  ) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Dois toques seguidos: o segundo parte do que o primeiro calculou (a tela ainda não mudou)
    const last = lastCount.get(task.id);
    const base = last && Date.now() - last.at < 3000 ? last.reps : reps;
    const next = Math.max(0, Math.min(plan.total, base + delta));
    lastCount.set(task.id, { reps: next, at: Date.now() });
    if (delta === -1) cancelRest(task);
    // mutateAsync: a resposta chega mesmo se a linha sair da tela (ver useToggleWithUndo)
    const result = log.mutateAsync({ task, delta, id: uuidv7(), values });
    const rest = delta === 1 && base < plan.total ? restAfterRep(plan, next) : null;
    if (rest)
      startTimer({
        kind: 'rest',
        seconds: rest.seconds,
        taskId: task.id,
        config: rest.after
          ? { label: task.title, after: true }
          : { label: `${task.title}, ${next + 1}/${plan.total}` },
      });
    return { next, result };
  };

  /** Desfaz a última (do aviso): a tarefa pode já estar concluída por ela. */
  const undo = (task: Task, plan: RepeatPlan, next: number) => {
    cancelRest(task);
    lastCount.set(task.id, { reps: Math.max(0, next - 1), at: Date.now() });
    log.mutate({
      task: { ...task, status: next >= plan.total ? 'done' : task.status },
      delta: -1,
      id: uuidv7(),
    });
  };

  return { logSet, undo };
}

/** +1 ou −1 com aviso: "Supino: 2/3"; na última, a recompensa. "Desfazer" no aviso. */
export function useRepWithToast() {
  const { logSet, undo } = useLogSet();
  const toast = useToast();
  const game = useGameState();
  const { t } = useTranslation();

  return (task: Task, plan: RepeatPlan, reps: number, delta: 1 | -1) => {
    const { next, result } = logSet(task, plan, reps, delta);
    const action = { label: t('common.undo'), onPress: () => undo(task, plan, next) };
    const message = t('repeat.logged', { title: task.title, done: next, total: plan.total });
    if (delta === 1) toast({ message, action });
    result.then(
      (rep) => {
        const reward =
          rep?.summary && game.data?.enabled !== false ? rewardMessage(rep.summary) : null;
        if (reward && delta === 1) toast({ message: `${message} · ${reward}`, action });
      },
      (err: Error) => toast({ message: err.message }),
    );
  };
}

/** Descanso desta tarefa em contagem grande, com −30/+30 e Pular (painel). */
function RestCountdown({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { timer, seconds, act } = useLiveTimer();
  if (timer?.kind !== 'rest' || timer.task_id !== task.id) return null;
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={t('timer.restLeft', { time: formatClock(seconds) })}
      className="flex-row flex-wrap items-center gap-2 rounded-lg border border-line p-3"
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('timer.rest')}
      </Text>
      <Text className="font-mono text-xl text-ink">{formatClock(seconds)}</Text>
      <AdjustButtons act={act} large />
      <Button variant="ghost" label={t('timer.skip')} onPress={() => act('skip')} />
    </View>
  );
}

/** Botão compacto da linha: "2/4"; tocar conta mais uma. */
export function RepeatButton({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { t } = useTranslation();
  const state = useReps(task);
  const rep = useRepWithToast();
  if (!state) return null;
  const { plan, reps } = state;
  const done = reps >= plan.total;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('repeat.oneMore', { title: task.title, done: reps, total: plan.total })}
      aria-disabled={disabled || done}
      disabled={disabled || done}
      onPress={() => rep(task, plan, reps, 1)}
      hitSlop={6}
      className={cn(
        'h-7 min-w-11 items-center justify-center rounded border border-line px-2 hover:bg-wash active:bg-wash',
        done && 'border-transparent',
      )}
    >
      <Text className={cn('font-mono text-xs', done ? 'text-ink-muted' : 'text-ink')}>
        {reps}/{plan.total}
      </Text>
    </Pressable>
  );
}

/** No painel: a conta grande, "Feita" e desfazer a última. */
export function RepeatCounter({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { t } = useTranslation();
  const state = useReps(task);
  const rep = useRepWithToast();
  if (!state) return null;
  const { plan, reps } = state;
  return (
    <View className="gap-3">
      <RestCountdown task={task} />
      <View className="flex-row flex-wrap items-center gap-3">
        <Text
          className="font-mono text-xl text-ink"
          accessibilityLabel={t('repeat.progress', { done: reps, total: plan.total })}
        >
          {reps}/{plan.total}
        </Text>
        <Button
          label={t(plan.mode === 'sets' ? 'repeat.doneSet' : 'repeat.doneOnce')}
          disabled={disabled || reps >= plan.total}
          onPress={() => rep(task, plan, reps, 1)}
        />
        <Button
          variant="ghost"
          label={t('repeat.undoLast')}
          disabled={disabled || reps === 0}
          onPress={() => rep(task, plan, reps, -1)}
        />
      </View>
    </View>
  );
}

const toInt = (text: string) => {
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : null;
};

/** Plano de repetição: tipo, quantas e descansos. Salva ao sair de cada campo. */
export function RepeatPlanEditor({
  value,
  onChange,
  disabled,
}: {
  value: RepeatPlan | null;
  onChange: (plan: RepeatPlan | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [total, setTotal] = useState(value?.total.toString() ?? '');
  const [rest, setRest] = useState(value?.rest_seconds?.toString() ?? '');
  const [restAfter, setRestAfter] = useState(value?.rest_after_seconds?.toString() ?? '');
  const [duration, setDuration] = useState(value?.duration_seconds?.toString() ?? '');
  const [interval, setInterval] = useState(value?.interval_minutes?.toString() ?? '');

  function pick(mode: RepeatMode | null) {
    if (!mode) return onChange(null);
    const next: RepeatPlan = {
      mode,
      total: value?.total ?? (mode === 'count' ? 8 : 3),
      ...(mode === 'sets' ? { rest_seconds: value?.rest_seconds ?? DEFAULT_REST_SECONDS } : {}),
      ...(mode === 'timed' ? { duration_seconds: value?.duration_seconds ?? 30 } : {}),
      ...(mode === 'interval' ? { interval_minutes: value?.interval_minutes ?? 60 } : {}),
    };
    setTotal(next.total.toString());
    setRest(next.rest_seconds?.toString() ?? '');
    setDuration(next.duration_seconds?.toString() ?? '');
    setInterval(next.interval_minutes?.toString() ?? '');
    onChange(next);
  }

  function save() {
    if (!value) return;
    const clamp = (n: number | null, min: number, max: number) =>
      n == null ? null : Math.max(min, Math.min(max, n));
    const next: RepeatPlan = {
      mode: value.mode,
      total: clamp(toInt(total), 1, 99) ?? value.total,
      rest_seconds: clamp(toInt(rest), 0, 3600),
      rest_after_seconds: clamp(toInt(restAfter), 0, 3600),
      duration_seconds: value.mode === 'timed' ? clamp(toInt(duration), 1, 3600) : null,
      interval_minutes: value.mode === 'interval' ? clamp(toInt(interval), 1, 1440) : null,
    };
    // Sem os vazios: o banco guarda só o que foi preenchido
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v != null),
    ) as RepeatPlan;
    setTotal(clean.total.toString());
    if (JSON.stringify(clean) !== JSON.stringify(value)) onChange(clean);
  }

  const fields = value
    ? [
        { label: t('repeat.total'), value: total, set: setTotal, max: 2 },
        ...(value.mode === 'timed'
          ? [{ label: t('repeat.duration'), value: duration, set: setDuration, max: 4 }]
          : []),
        ...(value.mode === 'interval'
          ? [{ label: t('repeat.interval'), value: interval, set: setInterval, max: 4 }]
          : []),
        ...(value.mode !== 'interval'
          ? [{ label: t('repeat.rest'), value: rest, set: setRest, max: 4 }]
          : []),
        { label: t('repeat.restAfter'), value: restAfter, set: setRestAfter, max: 4 },
      ]
    : [];

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        <Chip
          role="radio"
          label={t('repeat.none')}
          selected={!value}
          disabled={disabled}
          onPress={() => value && pick(null)}
        />
        {REPEAT_MODES.map((mode) => (
          <Chip
            key={mode}
            role="radio"
            label={t(MODE_LABEL[mode])}
            selected={value?.mode === mode}
            disabled={disabled}
            onPress={() => value?.mode !== mode && pick(mode)}
          />
        ))}
      </View>
      {fields.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {fields.map((field) => (
            <View key={field.label} className="min-w-24 flex-1 gap-1">
              <Text className="text-xs text-ink-muted">{field.label}</Text>
              <Input
                value={field.value}
                onChangeText={field.set}
                onBlur={save}
                onSubmitEditing={save}
                editable={!disabled}
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel={field.label}
                maxLength={field.max}
                className="font-mono"
              />
            </View>
          ))}
        </View>
      )}
      {!value && <Text className="text-xs text-ink-muted">{t('repeat.hint')}</Text>}
    </View>
  );
}
