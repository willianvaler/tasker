import { Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useActiveTimer, useTimerActions, type StartTimerVars } from '@/lib/queries/timers';
import {
  alertsSupported,
  ensureAlertPermission,
  permissionAsked,
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
    if (alertsSupported && !permissionAsked()) {
      toast({ message: t('timer.permissionWhy') });
      ensureAlertPermission().catch(() => false);
    }
    return start(vars).catch(() => {});
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
export function useLiveTimer(owner = false) {
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
    timerFinishedHere();
    actions.act(timer, 'done').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, timer?.id]);

  const act = (action: TimerAction, seconds = 0) => {
    if (timer) actions.act(timer, action, seconds).catch(() => {});
  };
  return { timer: elapsed ? null : timer, seconds: timer ? timerSeconds(timer, now) : 0, act };
}

export function timerLabel(timer: Timer, t: (key: (typeof KIND_LABEL)[TimerKind]) => string) {
  const config = (timer.config ?? {}) as { label?: string };
  const kind = t(KIND_LABEL[timer.kind as TimerKind] ?? 'timer.countdown');
  return config.label ? `${kind} · ${config.label}` : kind;
}

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
  const { timer, seconds, act } = useLiveTimer(true);
  if (!timer) return null;
  const label = timerLabel(timer, t);
  const clock = formatClock(seconds);
  const paused = timer.state === 'paused';
  const rest = timer.kind === 'rest';

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={t(paused ? 'timer.pausedLabel' : 'timer.label', { label, time: clock })}
      style={floating ? { position: 'absolute', right: 8, bottom: insets.bottom + 72 } : undefined}
      className="max-w-[360px] flex-row items-center gap-1 rounded-lg border border-line bg-surface pl-3 pr-1"
    >
      <Text className="shrink text-sm text-ink" numberOfLines={1}>
        {label}
      </Text>
      <Text className={cn('font-mono text-sm', paused ? 'text-ink-muted' : 'text-ink')}>
        {clock}
      </Text>
      {timer.kind !== 'stopwatch' && <AdjustButtons act={act} />}
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
          <IconButton icon={Square} label={t('timer.stop')} onPress={() => act('cancel')} />
        </>
      )}
    </View>
  );
}
