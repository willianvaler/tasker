import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pause, Play, SkipForward, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import i18next, { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLogSet } from '@/components/tasks/repeat';
import { TrainingPartners } from '@/components/training-partners';
import { AdjustButtons, useLiveTimer, useStartTimer } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Json } from '@/lib/db';
import { metaLabel } from '@/components/tasks/task-meta';
import type { TaskMeta } from '@/lib/parser/quick';
import { useGameState } from '@/lib/queries/game';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { useMyProgress } from '@/lib/queries/repeat';
import { usePageTasks, useToggleTask, useUpdateTask } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import {
  useWorkoutSession,
  useWorkoutSessionActions,
  type WorkoutSession,
} from '@/lib/queries/workout-session';
import { restAfterRep } from '@/lib/repeat';
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
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { useTaskCan } from '@/providers/write';

// Modo Treino (J5, D127): a página em sequência guiada, em tela cheia. Cada "Feita" conta uma
// série pelo log_rep (offline também), o descanso começa sozinho e, terminado o exercício, passa
// para o próximo. O andamento do treino (tempo, volume, pulados) fica no aparelho até o fim: feito
// o último exercício, o treino fecha sozinho com um aviso curto do que foi feito (16/10).

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
  const { id, sessao } = useLocalSearchParams<{ id: string; sessao?: string }>();
  const { t } = useTranslation();
  const tree = useTree();
  const page = tree.data?.pages.find((p) => p.id === id);
  const tasks = usePageTasks(id);
  const progress = useMyProgress();

  // AC10.1: todo treino aberto é uma sessão no servidor (online); em pasta compartilhada, antes
  // de começar, escolhe quem treina junto. Com mais de uma pessoa, a série vale para o grupo.
  const online = useIsOnline();
  const me = useSession().session?.user.id;
  const root = rootFolder(tree.data, page?.folder_id);
  // Projeto (ou grupo de treino) conta desde a criação; is_shared só liga no primeiro convite
  const togetherFolder = !!root && (root.is_shared || root.kind === 'project');
  const members = useMembers(togetherFolder ? root.id : undefined);
  const others = (members.data ?? []).filter((m) => m.userId !== me);
  const sessionActions = useWorkoutSessionActions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Em pasta compartilhada, antes de começar: com quem (até escolher)
  const [picked, setPicked] = useState(false);
  const [partners, setPartners] = useState<string[]>([]);
  const live = useWorkoutSession(sessionId);
  const inSession = (live.data?.members ?? []).filter((m) => m.status !== 'left');
  const group = live.data && !live.data.endedAt && inSession.length > 1 ? live.data : null;
  const items = workoutItems(tasks.data ?? [], group ? group.progress : (progress.data ?? {}));
  const partnerNames = inSession
    .filter((m) => m.userId !== me)
    .map((m) => (members.data ?? []).find((x) => x.userId === m.userId)?.displayName)
    .filter((name): name is string => !!name);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !online || !page) return;
    if (sessao) {
      started.current = true;
      sessionActions.join.mutateAsync(sessao).then(setSessionId, () => {});
      return;
    }
    // Em pasta compartilhada sempre pergunta (sozinho no grupo, o seletor oferece o convite)
    if (togetherFolder) return;
    started.current = true;
    sessionActions.start.mutateAsync({ pageId: id, withUsers: [] }).then(setSessionId, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, page, sessao, togetherFolder]);

  // Fechar o treino sai da sessão (sem ninguém dentro, ela termina)
  const sessionRef = useRef<string | null>(null);
  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);
  useEffect(
    () => () => {
      if (sessionRef.current) sessionActions.leave.mutateAsync(sessionRef.current).catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function startTogether() {
    sessionActions.start
      .mutateAsync({ pageId: id, withUsers: partners })
      .then(setSessionId, () => {})
      .finally(() => setPicked(true));
  }
  const picking = online && !sessao && !picked && togetherFolder && !members.isPending;

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
  // No grupo, o exercício atual é o da sessão: quem avança leva os outros junto
  const remoteTask = group?.state.task_id;
  const [followed, setFollowed] = useState<string | undefined>(undefined);
  if (remoteTask !== followed) {
    setFollowed(remoteTask);
    const at = items.findIndex((it) => it.task.id === remoteTask);
    if (at >= 0) setChosen(at);
  }
  const goTo = (next: number | null) => {
    setChosen(next);
    const taskId = next != null ? items[next]?.task.id : undefined;
    if (group && taskId)
      sessionActions.setState.mutate({ id: group.id, state: { task_id: taskId } });
  };
  const pending = nextPending(items, 0, session.skipped);
  const index = chosen != null && chosen < items.length ? chosen : pending;
  const finished = pending === -1 && (chosen == null || items[chosen]?.done !== false);

  // Fim do treino: espera (no máximo 1,5 s) a resposta da última série para o XP entrar no aviso,
  // tira a série da tela de bloqueio, encerra o descanso que sobrou e sai com o resumo num aviso
  const toast = useToast();
  const game = useGameState();
  const rest = useLiveTimer();
  const startTimer = useStartTimer();
  const remoteRest = group?.state.rest_ends_at ?? null;
  const appliedRest = useRef<string | null>(null);
  useEffect(() => {
    if (!remoteRest || appliedRest.current === remoteRest) return;
    appliedRest.current = remoteRest;
    const left = Math.round((Date.parse(remoteRest) - Date.now()) / 1000);
    if (left < 5) return;
    startTimer({
      kind: 'rest',
      seconds: left,
      taskId: remoteTask,
      config: { label: t('together.rest') },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRest]);
  const lastResult = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(session);
  useEffect(() => {
    latest.current = session;
  });
  useEffect(() => {
    if (!finished || tasks.isPending || items.length === 0) return;
    void clearWorkoutNotification();
    if (rest.timer?.kind === 'rest') rest.act('cancel');
    let gone = false;
    const wait = new Promise((resolve) => setTimeout(resolve, 1500));
    void Promise.race([lastResult.current.catch(() => {}), wait]).then(() => {
      if (gone) return;
      const s = latest.current;
      toast({ message: finishedMessage(s, game.data?.enabled !== false, t, partnerNames) });
      localStore.removeItem(sessionKey(id));
      close();
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, tasks.isPending]);

  if (picking)
    return (
      <Shell title={page ? pageLabel(page) : ''}>
        <TrainingPartners
          people={others}
          onInvite={
            root
              ? () => router.push({ pathname: '/share/[id]', params: { id: root.id } })
              : undefined
          }
          selected={partners}
          onChange={setPartners}
          onStart={startTogether}
          busy={sessionActions.start.isPending}
        />
      </Shell>
    );
  if (tasks.isPending) return <Shell title={page ? pageLabel(page) : ''}>{null}</Shell>;
  if (items.length === 0)
    return (
      <Shell title={page ? pageLabel(page) : ''}>
        <EmptyState title={t('workout.empty')} />
      </Shell>
    );
  if (finished)
    return (
      <Shell title={page ? pageLabel(page) : ''}>
        <Text className="text-xl font-semibold text-ink" accessibilityRole="header">
          {t('workout.finishedTitle')}
        </Text>
      </Shell>
    );
  return (
    <Running
      title={page ? pageLabel(page) : ''}
      cards={page?.view_type === 'cards'}
      items={items}
      index={index === -1 ? 0 : index}
      session={session}
      setSession={setSession}
      goTo={goTo}
      onResult={(result) => {
        lastResult.current = result;
      }}
      group={group}
      partnerNames={partnerNames}
      onRestShared={(iso) => {
        appliedRest.current = iso;
      }}
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
  onResult,
  group,
  partnerNames,
  onRestShared,
}: {
  title: string;
  cards: boolean;
  items: WorkoutItem[];
  index: number;
  session: Session;
  setSession: (update: (s: Session) => Session) => void;
  goTo: (index: number | null) => void;
  /** A resposta da série (o fim do treino espera a última, para o XP) */
  onResult: (result: Promise<unknown>) => void;
  /** Treino junto (AC10.1): a série vale para o grupo */
  group: WorkoutSession | null;
  partnerNames: string[];
  /** O descanso que este aparelho mandou para a sessão (para não começá-lo duas vezes) */
  onRestShared: (iso: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const item = items[index];
  const task = item.task;
  const allowed = useTaskCan(task);
  const { logSet } = useLogSet();
  const sessionActions = useWorkoutSessionActions();
  const startTimer = useStartTimer();
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
    if (group) {
      const values = { weight: meta.weight ?? null, reps: meta.reps ?? null };
      const next = Math.min(item.plan.total, item.reps + 1);
      const result = sessionActions.logGroupSet.mutateAsync({
        id: group.id,
        taskId: task.id,
        delta: 1,
        values,
      });
      onResult(result);
      result.then(
        (r) => addXp((r as { summary?: { xp?: number } })?.summary?.xp),
        () => {},
      );
      const restInfo = item.repeats ? restAfterRep(item.plan, next) : null;
      if (restInfo) {
        startTimer({
          kind: 'rest',
          seconds: restInfo.seconds,
          taskId: task.id,
          config: {
            label: `${task.title}, ${Math.min(next + 1, item.plan.total)}/${item.plan.total}`,
          },
        });
        const iso = new Date(Date.now() + restInfo.seconds * 1000).toISOString();
        onRestShared(iso);
        sessionActions.setState.mutate({ id: group.id, state: { rest_ends_at: iso } });
      }
      if (next >= item.plan.total) advance();
    } else if (item.repeats) {
      const values = { weight: meta.weight ?? null, reps: meta.reps ?? null };
      const { next, result } = logSet(task, item.plan, item.reps, 1, values);
      onResult(result);
      result.then(
        (r) => addXp(r?.summary?.xp),
        () => {},
      );
      if (next >= item.plan.total) advance();
    } else {
      const result = toggle.mutateAsync({ id: task.id, done: true });
      onResult(result);
      result.then(
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
        {partnerNames.length > 0 && (
          <Text className="text-sm text-ink-muted">
            {t('together.with', { names: partnerNames.join(', ') })}
          </Text>
        )}
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

/** "Treino concluído · 12 séries · 42:10 · 1.250 kg · +60 XP · 1 pulado" */
function finishedMessage(session: Session, game: boolean, t: TFunction, partners: string[] = []) {
  const elapsed = workoutElapsed(session, Date.now());
  if (session.sets === 0 && session.skipped.length === 0) return t('workout.allDone');
  const volume = new Intl.NumberFormat(i18next.language, { maximumFractionDigits: 1 }).format(
    session.volume,
  );
  return [
    t('workout.finishedTitle'),
    t('workout.toastSets', { count: session.sets }),
    formatClock(elapsed),
    session.volume > 0 ? `${volume} kg` : null,
    game && session.xp > 0 ? `+${session.xp} XP` : null,
    session.skipped.length ? t('workout.toastSkipped', { count: session.skipped.length }) : null,
    partners.length ? t('together.with', { names: partners.join(', ') }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
