import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pause, Play, SkipForward, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLogSet } from '@/components/tasks/repeat';
import { AdjustButtons, useLiveTimer } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Json } from '@/lib/db';
import { metaLabel } from '@/components/tasks/task-meta';
import type { TaskMeta } from '@/lib/parser/quick';
import { useMyProgress } from '@/lib/queries/repeat';
import { usePageTasks, useToggleTask, useUpdateTask } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { selection } from '@/lib/selection';
import { localStore } from '@/lib/storage';
import { formatClock } from '@/lib/timers';
import { ensureAlertPermission } from '@/lib/timer-alerts';
import { useShortcut } from '@/lib/use-shortcut';
import {
  clearWorkoutNotification,
  onWorkoutAction,
  showWorkoutNotification,
} from '@/lib/workout-notification';
import { useWakeLock } from '@/lib/wake-lock';
import {
  adjustWeight,
  nextPending,
  parseWeight,
  setVolume,
  workoutElapsed,
  workoutItems,
  workoutProgress,
  type WorkoutItem,
} from '@/lib/workout';
import { useTaskCan } from '@/providers/write';

// Modo Treino (J5, D127): a página em sequência guiada, em tela cheia. Cada "Feita" conta uma
// série pelo log_rep (offline também), o descanso começa sozinho e, terminado o exercício, passa
// para o próximo. O andamento do treino (tempo, volume, pulados) fica no aparelho até "Concluir".

type Session = {
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  sets: number;
  volume: number;
  xp: number;
  skipped: string[];
};

const sessionKey = (pageId: string) => `questlist:workout:${pageId}`;
// Treino aberto há mais de 12 h é outro treino
const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

function loadSession(pageId: string): Session {
  const fresh = {
    startedAt: Date.now(),
    pausedMs: 0,
    pausedAt: null,
    sets: 0,
    volume: 0,
    xp: 0,
    skipped: [],
  };
  try {
    const saved = JSON.parse(localStore.getItem(sessionKey(pageId)) ?? 'null') as Session | null;
    return saved && Date.now() - saved.startedAt < SESSION_MAX_MS ? saved : fresh;
  } catch {
    return fresh;
  }
}

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const tree = useTree();
  const page = tree.data?.pages.find((p) => p.id === id);
  const tasks = usePageTasks(id);
  const progress = useMyProgress();
  const items = workoutItems(tasks.data ?? [], progress.data ?? {});

  const [session, setSession] = useState(() => loadSession(id));
  useEffect(() => {
    localStore.setItem(sessionKey(id), JSON.stringify(session));
  }, [id, session]);
  // Atalhos de lista (Espaço marca a selecionada) não podem disputar com os do treino
  useEffect(() => selection.select(null), []);
  useWakeLock(true);
  // X1: a série na tela de bloqueio precisa da permissão de notificação
  useEffect(() => {
    if (Platform.OS !== 'web') ensureAlertPermission().catch(() => false);
  }, []);

  // X1: sair do treino (fechar a tela) tira a série da tela de bloqueio. Fica aqui, e não na tela
  // da série, porque ela remonta (ex.: quando a primeira sincronização termina)
  useEffect(() => () => void clearWorkoutNotification(), []);

  const [chosen, setChosen] = useState<number | null>(null);
  const pending = nextPending(items, 0, session.skipped);
  const index = chosen != null && chosen < items.length ? chosen : pending;
  const finished = pending === -1 && (chosen == null || items[chosen]?.done !== false);
  // Treino terminado (resumo na tela): a série sai da tela de bloqueio
  useEffect(() => {
    if (finished) void clearWorkoutNotification();
  }, [finished]);

  if (tasks.isPending) return <Shell title={page ? pageLabel(page) : ''}>{null}</Shell>;
  if (items.length === 0)
    return (
      <Shell title={page ? pageLabel(page) : ''}>
        <EmptyState title={t('workout.empty')} />
      </Shell>
    );
  if (finished)
    return (
      <Summary
        title={page ? pageLabel(page) : ''}
        session={session}
        skipped={session.skipped.length}
        onFinish={() => {
          localStore.removeItem(sessionKey(id));
          close();
        }}
      />
    );
  return (
    <Running
      title={page ? pageLabel(page) : ''}
      cards={page?.view_type === 'cards'}
      items={items}
      index={index === -1 ? 0 : index}
      session={session}
      setSession={setSession}
      goTo={setChosen}
    />
  );
}

function Shell({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="min-h-12 flex-row items-center gap-2 border-b border-line px-2">
        <IconButton icon={X} label={t('workout.exit')} onPress={close} />
        <Text className="flex-1 font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
          {t('workout.title')} · {title}
        </Text>
        {right}
      </View>
      <ScrollView contentContainerClassName="w-full max-w-xl self-center gap-6 p-4">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Tempo do treino, redesenhado a cada segundo (sai do horário de início, não de uma contagem). */
function useElapsed(session: Session) {
  const [now, setNow] = useState(() => Date.now());
  const paused = session.pausedAt != null;
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused]);
  return workoutElapsed(session, now);
}

function Running({
  title,
  cards,
  items,
  index,
  session,
  setSession,
  goTo,
}: {
  title: string;
  cards: boolean;
  items: WorkoutItem[];
  index: number;
  session: Session;
  setSession: (update: (s: Session) => Session) => void;
  goTo: (index: number | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const item = items[index];
  const task = item.task;
  const allowed = useTaskCan(task);
  const { logSet } = useLogSet();
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const rest = useLiveTimer();
  const resting = rest.timer?.kind === 'rest' ? rest.timer : null;
  const elapsed = useElapsed(session);
  const paused = session.pausedAt != null;
  const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
  const totals = workoutProgress(items);
  const lb = parseWeight(meta.weight)?.unit.startsWith('lb');
  const step = lb ? 5 : 2.5;
  const decimalComma = !i18n.language.startsWith('en');

  /** Próximo depois deste, contando este como feito (a lista ainda não refletiu). */
  const advance = (skipped = session.skipped) => {
    const after = items.map((it, i) => (i === index ? { ...it, done: true } : it));
    const next = nextPending(after, index + 1, skipped);
    goTo(next === -1 ? null : next);
  };

  function done() {
    if (paused || item.done || !allowed.complete) return false;
    const addXp = (xp: number | undefined) => xp && setSession((s) => ({ ...s, xp: s.xp + xp }));
    setSession((s) => ({ ...s, sets: s.sets + 1, volume: s.volume + setVolume(meta) }));
    if (item.repeats) {
      const values = { weight: meta.weight ?? null, reps: meta.reps ?? null };
      const { next, result } = logSet(task, item.plan, item.reps, 1, values);
      result.then(
        (r) => addXp(r?.summary?.xp),
        () => {},
      );
      if (next >= item.plan.total) advance();
    } else {
      toggle.mutateAsync({ id: task.id, done: true }).then(
        (s) => addXp(s?.xp),
        () => {},
      );
      advance();
    }
  }

  function skip() {
    const skipped = [...session.skipped, task.id];
    setSession((s) => ({ ...s, skipped }));
    if (resting) rest.act('skip');
    advance(skipped);
  }

  function togglePause() {
    const now = Date.now();
    setSession((s) =>
      s.pausedAt == null
        ? { ...s, pausedAt: now }
        : { ...s, pausedAt: null, pausedMs: s.pausedMs + (now - s.pausedAt) },
    );
    if (resting) rest.act(paused ? 'resume' : 'pause');
  }

  const save = (patch: { meta?: TaskMeta; repeat_plan?: unknown }) =>
    update.mutate({
      id: task.id,
      patch: {
        ...(patch.meta ? { meta: patch.meta as Json } : {}),
        ...(patch.repeat_plan ? { repeat_plan: patch.repeat_plan as Json } : {}),
      },
    });

  useShortcut('workout.done', done);
  useShortcut('workout.skipRest', () => {
    if (!resting) return false;
    rest.act('skip');
  });

  const counter = item.repeats
    ? t(item.plan.mode === 'sets' ? 'workout.set' : 'workout.time', {
        n: Math.min(item.reps + 1, item.plan.total),
        total: item.plan.total,
      })
    : t('workout.single');

  // X1: a mesma série na tela de bloqueio, com os botões que não pedem para destravar
  const lockTitle = `${task.title}${metaLabel(meta) ? ` · ${metaLabel(meta)}` : ''}`;
  const restUntil =
    resting?.ends_at && resting.state === 'running'
      ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(
          new Date(resting.ends_at),
        )
      : null;
  const lockBody = restUntil
    ? t('lock.resting', { until: restUntil, next: counter })
    : t('lock.now', { counter, exercise: index + 1, total: items.length });
  useEffect(() => {
    showWorkoutNotification({ title: lockTitle, body: lockBody, resting: !!restUntil }).catch(
      () => {},
    );
  }, [lockTitle, lockBody, restUntil]);
  // Os botões da notificação chamam a versão mais nova das ações
  const lockActions = useRef({ done, skipRest: () => {}, plus30: () => {} });
  useEffect(() => {
    lockActions.current = {
      done,
      skipRest: () => resting && rest.act('skip'),
      plus30: () => resting && rest.act('adjust', 30),
    };
  });
  useEffect(
    () =>
      onWorkoutAction((action) => {
        if (action === 'done') lockActions.current.done();
        else if (action === 'skip_rest') lockActions.current.skipRest();
        else lockActions.current.plus30();
      }),
    [],
  );

  return (
    <Shell
      title={title}
      right={
        <>
          <Text
            className={cn('font-mono text-sm', paused ? 'text-ink-muted' : 'text-ink')}
            accessibilityLabel={t('workout.elapsed', { time: formatClock(elapsed) })}
          >
            {formatClock(elapsed)}
          </Text>
          <IconButton
            icon={paused ? Play : Pause}
            label={t(paused ? 'workout.resume' : 'workout.pause')}
            onPress={togglePause}
          />
        </>
      }
    >
      <ProgressBar
        value={totals.total ? totals.done / totals.total : 0}
        label={t('workout.progress', { done: totals.done, total: totals.total })}
      />

      <View className="gap-2">
        <Text className="font-mono text-xs uppercase text-ink-muted">
          {t('workout.exercise', { n: index + 1, total: items.length })}
        </Text>
        <Text className="text-xl font-semibold text-ink" accessibilityRole="header">
          {task.title}
        </Text>
        {metaLabel(meta) ? (
          <Text className="font-mono text-sm text-ink-muted">{metaLabel(meta)}</Text>
        ) : null}
        <Text className="text-lg text-ink">{item.done ? t('workout.alreadyDone') : counter}</Text>
      </View>

      {resting && (
        <View
          accessibilityRole="timer"
          accessibilityLabel={t('timer.restLeft', { time: formatClock(rest.seconds) })}
          className="items-center gap-3 border-y border-line py-4"
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('timer.rest')}
          </Text>
          <Text className="font-mono text-xl text-ink">{formatClock(rest.seconds)}</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            <AdjustButtons act={rest.act} large />
            <Button
              variant="ghost"
              label={t('workout.skipRest')}
              onPress={() => rest.act('skip')}
            />
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.done')}
        accessibilityHint={t('workout.doneHint')}
        aria-disabled={paused || item.done || !allowed.complete}
        disabled={paused || item.done || !allowed.complete}
        onPress={done}
        className={cn(
          'min-h-20 items-center justify-center rounded-lg bg-accent active:opacity-80',
          (paused || item.done || !allowed.complete) && 'opacity-40',
        )}
      >
        <Text className="text-xl font-semibold text-paper">{t('workout.done')}</Text>
      </Pressable>

      {(cards || meta.weight) && allowed.edit && !item.done && (
        <View className="flex-row items-center justify-center gap-3">
          <Button
            variant="ghost"
            label={`−${String(step).replace('.', decimalComma ? ',' : '.')}`}
            accessibilityLabel={t('workout.lighter')}
            onPress={() =>
              save({ meta: { ...meta, weight: adjustWeight(meta.weight, -step, decimalComma) } })
            }
          />
          <Text
            className="min-w-20 text-center font-mono text-base text-ink"
            accessibilityLabel={t('workout.load', { weight: meta.weight ?? '—' })}
          >
            {meta.weight ?? '—'}
          </Text>
          <Button
            variant="ghost"
            label={`+${String(step).replace('.', decimalComma ? ',' : '.')}`}
            accessibilityLabel={t('workout.heavier')}
            onPress={() =>
              save({ meta: { ...meta, weight: adjustWeight(meta.weight, step, decimalComma) } })
            }
          />
        </View>
      )}

      <View className="flex-row flex-wrap justify-center gap-2">
        <Button
          variant="ghost"
          icon={ChevronLeft}
          label={t('workout.previous')}
          disabled={index === 0}
          onPress={() => goTo(index - 1)}
        />
        {allowed.edit && !item.done && (
          <Button
            variant="ghost"
            label={t('workout.addSet')}
            onPress={() =>
              save({
                repeat_plan: item.repeats
                  ? { ...item.plan, total: Math.min(item.plan.total + 1, 99) }
                  : { mode: 'sets', total: 2 },
              })
            }
          />
        )}
        <Button variant="ghost" icon={SkipForward} label={t('workout.skip')} onPress={skip} />
      </View>
    </Shell>
  );
}

function Summary({
  title,
  session,
  skipped,
  onFinish,
}: {
  title: string;
  session: Session;
  skipped: number;
  onFinish: () => void;
}) {
  const { t, i18n } = useTranslation();
  // Na hora em que o resumo abriu (o treino acabou)
  const [elapsed] = useState(() => workoutElapsed(session, Date.now()));
  const volume = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
    session.volume,
  );
  const rows = [
    { label: t('workout.summaryTime'), value: formatClock(elapsed) },
    { label: t('workout.summarySets'), value: String(session.sets) },
    ...(session.volume > 0 ? [{ label: t('workout.summaryVolume'), value: `${volume} kg` }] : []),
    { label: t('workout.summaryXp'), value: `+${session.xp}` },
    ...(skipped ? [{ label: t('workout.summarySkipped'), value: String(skipped) }] : []),
  ];
  return (
    <Shell title={title}>
      <Text className="text-xl font-semibold text-ink" accessibilityRole="header">
        {t('workout.finishedTitle')}
      </Text>
      <View className="gap-1" accessibilityRole="list">
        {rows.map((row) => (
          <View
            key={row.label}
            accessibilityRole="text"
            accessibilityLabel={`${row.label}: ${row.value}`}
            className="min-h-11 flex-row items-center border-b border-line"
          >
            <Text className="flex-1 text-base text-ink">{row.label}</Text>
            <Text className="font-mono text-base text-ink">{row.value}</Text>
          </View>
        ))}
      </View>
      <Button label={t('workout.finish')} onPress={onFinish} />
    </Shell>
  );
}
