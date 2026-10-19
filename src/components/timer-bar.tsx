import type { TFunction } from 'i18next';
import { Pause, Play, Square } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  DEFAULT_POMODORO,
  nextPhase,
  phaseSeconds,
  pickIdea,
  type PomodoroConfig,
  type PomodoroPhase,
} from '@/lib/pomodoro';
import { useGameState } from '@/lib/queries/game';
import { usePomodoroSettings } from '@/lib/queries/pomodoro';
import { SIZE } from '@/lib/tokens';
import { useTask } from '@/lib/queries/tasks';
import { useActiveTimer, useTimerActions, type StartTimerVars } from '@/lib/queries/timers';
import {
  alertsSupported,
  canVibrate,
  ensureAlertPermission,
  permissionAsked,
  primeAudio,
  syncTimerAlert,
  timerFinishedHere,
} from '@/lib/timer-alerts';
import {
  formatClock,
  timerElapsed,
  timerSeconds,
  type Timer,
  type TimerAction,
  type TimerKind,
} from '@/lib/timers';
import { useWakeLock } from '@/lib/wake-lock';
import { useToast } from '@/providers/toast';

// Mini-barra do timer ativo (J2/J3, D124/D125): um por pessoa, o mesmo em todos os aparelhos. O
// tempo é sempre recalculado do horário de fim; o intervalo só redesenha.

const KIND_LABEL = {
  rest: 'timer.rest',
  pomodoro: 'timer.pomodoro',
  stopwatch: 'timer.stopwatch',
  countdown: 'timer.countdown',
} as const satisfies Record<TimerKind, string>;

/** Inicia um timer; no primeiro, explica e pede a permissão de aviso (no celular). */
export function useStartTimer() {
  const { start } = useTimerActions();
  const toast = useToast();
  const { t } = useTranslation();
  return (vars: StartTimerVars) => {
    // No toque que inicia: o navegador só deixa tocar som depois de um gesto
    primeAudio();
    if (alertsSupported && !permissionAsked()) {
      const why = t('timer.permissionWhy');
      toast({ message: canVibrate() ? why : `${why} ${t('timer.noVibration')}` });
      ensureAlertPermission().catch(() => false);
    }
    return start(vars).catch(() => {});
  };
}

/** Sugestões de pausa: as do usuário ou as padrão do idioma. */
export function useBreakIdeas() {
  const { t } = useTranslation();
  const settings = usePomodoroSettings().data ?? DEFAULT_POMODORO;
  return (
    settings.break_ideas ?? [
      t('pomodoro.idea1'),
      t('pomodoro.idea2'),
      t('pomodoro.idea3'),
      t('pomodoro.idea4'),
      t('pomodoro.idea5'),
    ]
  );
}

/** Pomodoro (K1, D129): começar um foco (solto ou numa tarefa) e passar para a fase seguinte. */
export function usePomodoro() {
  const settings = usePomodoroSettings().data ?? DEFAULT_POMODORO;
  const ideas = useBreakIdeas();
  const startTimer = useStartTimer();

  const begin = (config: PomodoroConfig, taskId: string | null) =>
    startTimer({
      kind: 'pomodoro',
      seconds: phaseSeconds(settings, config.phase),
      taskId,
      config,
    });

  return {
    settings,
    start: (task?: { id: string; title: string } | null) =>
      begin(
        {
          phase: 'focus',
          cycle: 1,
          label: task?.title,
          idea: pickIdea(ideas, settings.idea_order, 0),
        },
        task?.id ?? null,
      ),
    /** A fase seguinte à deste timer (foco → pausa → foco...). */
    next: (timer: Timer) => {
      const config = (timer.config ?? {}) as Partial<PomodoroConfig>;
      const step = nextPhase(
        { phase: config.phase ?? 'focus', cycle: config.cycle ?? 1 },
        settings.cycles,
      );
      return begin(
        {
          ...step,
          label: config.label,
          // Em ordem: uma sugestão por foco do ciclo
          idea:
            step.phase === 'focus'
              ? pickIdea(ideas, settings.idea_order, step.cycle - 1)
              : config.idea,
        },
        timer.task_id,
      );
    },
  };
}

/** Agora, redesenhando a cada 250 ms enquanto o timer roda. */
function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

/**
 * Timer ativo com o tempo de agora. `owner` (só a mini-barra, montada uma vez): agenda o aviso
 * do celular e, ao chegar a zero, vibra e marca como feito.
 */
export function useLiveTimer(owner = false, onFinished?: (timer: Timer) => void) {
  const timer = useActiveTimer().data ?? null;
  const actions = useTimerActions();
  const now = useNow(timer?.state === 'running');
  const elapsed = !!timer && timerElapsed(timer, now);

  // Aviso do celular acompanha o timer (iniciado aqui ou em outro aparelho)
  const scheduled = useRef<string | null>(null);
  useEffect(() => {
    if (!owner) return;
    const previous = scheduled.current;
    scheduled.current = timer?.id ?? null;
    syncTimerAlert(timer, previous).catch(() => {});
  }, [timer, owner]);

  // Qualquer aparelho pode marcar como feito; o servidor ignora o repetido
  useEffect(() => {
    if (!owner || !timer || !elapsed) return;
    timerFinishedHere(timer.id);
    actions.act(timer, 'done').catch(() => {});
    onFinished?.(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, timer?.id]);

  const act = (action: TimerAction, seconds = 0) => {
    if (timer) actions.act(timer, action, seconds).catch(() => {});
  };
  return { timer: elapsed ? null : timer, seconds: timer ? timerSeconds(timer, now) : 0, act };
}

type T = TFunction;

export function timerLabel(timer: Timer, t: T, cycles = DEFAULT_POMODORO.cycles) {
  const config = (timer.config ?? {}) as Partial<PomodoroConfig>;
  const kind =
    timer.kind === 'pomodoro'
      ? config.phase === 'short'
        ? t('pomodoro.short')
        : config.phase === 'long'
          ? t('pomodoro.long')
          : t('pomodoro.focus', { cycle: config.cycle ?? 1, cycles })
      : t(KIND_LABEL[timer.kind as TimerKind] ?? 'timer.countdown');
  return config.label ? `${kind} · ${config.label}` : kind;
}

/** Fim de uma fase do pomodoro: a seguinte começa sozinha ou fica no aviso (D129). */
function usePomodoroFinished() {
  const { t } = useTranslation();
  const toast = useToast();
  const pomodoro = usePomodoro();
  const game = useGameState();
  return (timer: Timer) => {
    if (timer.kind !== 'pomodoro') return;
    const config = (timer.config ?? {}) as Partial<PomodoroConfig>;
    const focus = (config.phase ?? 'focus') === 'focus';
    const step = nextPhase(
      { phase: config.phase ?? 'focus', cycle: config.cycle ?? 1 },
      pomodoro.settings.cycles,
    );
    const message = focus
      ? config.idea
        ? t('pomodoro.focusDone', { idea: config.idea })
        : t('pomodoro.focusDoneNoIdea')
      : t('pomodoro.breakDone');
    // O XP do pomodoro (K4) vem do servidor: relê o jogo
    if (focus && game.data?.enabled !== false) setTimeout(() => game.refetch(), 1500);
    if (pomodoro.settings.auto_start) {
      pomodoro.next(timer);
      toast({
        message: `${message} ${t('pomodoro.autoNext', { phase: phaseName(step.phase, t) })}`,
      });
      return;
    }
    toast({
      message,
      action: {
        label: focus
          ? t('pomodoro.startBreak', {
              minutes: phaseSeconds(pomodoro.settings, step.phase) / 60,
            })
          : t('pomodoro.startFocus'),
        onPress: () => pomodoro.next(timer),
      },
    });
  };
}

const phaseName = (phase: PomodoroPhase, t: T) =>
  phase === 'focus'
    ? t('pomodoro.backToFocus')
    : phase === 'short'
      ? t('pomodoro.short')
      : t('pomodoro.long');

/** −30 s · +30 s em botões de texto (o −30 nunca volta antes de agora). */
export function AdjustButtons({
  act,
  large,
}: {
  act: (a: TimerAction, s?: number) => void;
  large?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {[-30, 30].map((seconds) => (
        <Pressable
          key={seconds}
          accessibilityRole="button"
          accessibilityLabel={t(seconds < 0 ? 'timer.minus30' : 'timer.plus30')}
          onPress={() => act('adjust', seconds)}
          className={cn(
            'items-center justify-center rounded border border-line hover:bg-wash active:bg-wash',
            large ? 'h-11 min-w-16 px-3' : 'h-8 min-w-11 px-2',
          )}
        >
          <Text className="font-mono text-xs text-ink">{seconds < 0 ? '−30' : '+30'}</Text>
        </Pressable>
      ))}
    </>
  );
}

export function TimerBar({ floating }: { floating?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // No Modo Treino o descanso já está na tela, em grande
  const inWorkout = (usePathname() ?? '').startsWith('/treino');
  const finished = usePomodoroFinished();
  const settings = usePomodoroSettings().data ?? DEFAULT_POMODORO;
  const { timer, seconds, act } = useLiveTimer(true, finished);
  // Pomodoro numa tarefa já concluída: oferece encerrar
  const task = useTask(timer?.kind === 'pomodoro' ? (timer.task_id ?? undefined) : undefined);
  // Tela acesa durante o descanso (no treino, a tela não pode apagar no meio da contagem)
  useWakeLock(timer?.kind === 'rest' && timer.state === 'running');
  if (!timer || inWorkout) return null;
  const label = timerLabel(timer, t, settings.cycles);
  const taskDone = timer.kind === 'pomodoro' && task.data?.status === 'done';
  const clock = formatClock(seconds);
  const paused = timer.state === 'paused';
  const rest = timer.kind === 'rest';

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={t(paused ? 'timer.pausedLabel' : 'timer.label', { label, time: clock })}
      style={
        floating
          ? { position: 'absolute', right: 8, bottom: insets.bottom + SIZE.timerBar }
          : undefined
      }
      className="max-w-[360px] flex-row items-center gap-1 rounded-lg border border-line bg-surface pl-3 pr-1"
    >
      <Text className="shrink text-sm text-ink" numberOfLines={1}>
        {label}
      </Text>
      <Text className={cn('font-mono text-sm', paused ? 'text-ink-muted' : 'text-ink')}>
        {clock}
      </Text>
      {timer.kind !== 'stopwatch' && <AdjustButtons act={act} />}
      {taskDone && (
        <Pressable
          accessibilityRole="button"
          onPress={() => act('cancel')}
          className="h-8 items-center justify-center rounded px-2 hover:bg-wash active:bg-wash"
        >
          <Text className="text-xs font-semibold text-accent">{t('pomodoro.taskDone')}</Text>
        </Pressable>
      )}
      {rest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('timer.skip')}
          onPress={() => act('skip')}
          className="h-8 items-center justify-center rounded px-2 hover:bg-wash active:bg-wash"
        >
          <Text className="text-xs font-semibold text-accent">{t('timer.skip')}</Text>
        </Pressable>
      ) : (
        <>
          <IconButton
            icon={paused ? Play : Pause}
            label={t(paused ? 'timer.resume' : 'timer.pause')}
            onPress={() => act(paused ? 'resume' : 'pause')}
          />
          <IconButton
            icon={Square}
            label={t('timer.stop')}
            // Cronômetro parado guarda o tempo (K3); os outros só param
            onPress={() => act(timer.kind === 'stopwatch' ? 'done' : 'cancel')}
          />
        </>
      )}
    </View>
  );
}
