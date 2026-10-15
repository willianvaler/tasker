import { Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useActiveTimer, useTimerActions } from '@/lib/queries/timers';
import { formatClock, timerElapsed, timerSeconds, type TimerKind } from '@/lib/timers';

// Mini-barra do timer ativo (J2, D124): um por pessoa, o mesmo em todos os aparelhos. O tempo é
// sempre recalculado do horário de fim; o intervalo só redesenha.

const KIND_LABEL = {
  rest: 'timer.rest',
  pomodoro: 'timer.pomodoro',
  stopwatch: 'timer.stopwatch',
  countdown: 'timer.countdown',
} as const satisfies Record<TimerKind, string>;

export function TimerBar({ floating }: { floating?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const timer = useActiveTimer().data;
  const actions = useTimerActions();
  const [now, setNow] = useState(() => Date.now());
  const running = timer?.state === 'running';

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, timer?.id]);

  // Chegou ao fim: termina (qualquer aparelho pode mandar; o servidor ignora o repetido)
  const elapsed = !!timer && timerElapsed(timer, now);
  useEffect(() => {
    if (timer && elapsed) actions.act(timer, 'done').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, timer?.id]);

  if (!timer || elapsed) return null;
  const config = (timer.config ?? {}) as { label?: string };
  const kind = t(KIND_LABEL[timer.kind as TimerKind] ?? 'timer.countdown');
  const label = config.label ? `${kind} · ${config.label}` : kind;
  const clock = formatClock(timerSeconds(timer, now));
  const paused = timer.state === 'paused';

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={t(paused ? 'timer.pausedLabel' : 'timer.label', { label, time: clock })}
      style={floating ? { position: 'absolute', right: 8, bottom: insets.bottom + 72 } : undefined}
      className="max-w-80 flex-row items-center gap-1 rounded-lg border border-line bg-surface pl-3"
    >
      <Text className="shrink text-sm text-ink" numberOfLines={1}>
        {label}
      </Text>
      <Text className={paused ? 'font-mono text-sm text-ink-muted' : 'font-mono text-sm text-ink'}>
        {clock}
      </Text>
      <IconButton
        icon={paused ? Play : Pause}
        label={t(paused ? 'timer.resume' : 'timer.pause')}
        onPress={() => actions.act(timer, paused ? 'resume' : 'pause').catch(() => {})}
      />
      <IconButton
        icon={Square}
        label={t('timer.stop')}
        onPress={() => actions.act(timer, 'cancel').catch(() => {})}
      />
    </View>
  );
}
