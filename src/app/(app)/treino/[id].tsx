import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pause, Play, SkipForward, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import i18next, { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { prescriptionMeta, useProgression, useWhy } from '@/components/gym/progression';
import { parseDecimal, SetRow, type SetDraft } from '@/components/gym/set-row';
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
import { useExercise } from '@/lib/queries/exercises';
import { useGameState } from '@/lib/queries/game';
import { useGymPrefs, useTimeZone } from '@/lib/queries/profile';
import { useActiveTimer, useTimerActions } from '@/lib/queries/timers';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { useMyProgress } from '@/lib/queries/repeat';
import { usePageTasks, useToggleTask, useUpdateTask } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import {
  useWorkoutHistory,
  useWorkoutSetActions,
  type SetKind,
  type SetValues,
} from '@/lib/queries/workout-sets';
import { setRecords, type RecordSet } from '@/lib/gym/records';
import { textToKg } from '@/lib/gym/units';
import { todayIn } from '@/lib/parser/dates';
import {
  useWorkoutSession,
  useWorkoutSessionActions,
  type WorkoutSession,
} from '@/lib/queries/workout-session';
import { restAfterRep } from '@/lib/repeat';
import { selection } from '@/lib/selection';
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
  clearWorkoutRun,
  loadWorkoutRun,
  saveWorkoutRun,
  type WorkoutRun,
} from '@/lib/workout-store';
import {
  adjustSetWeight,
  nextPending,
  parseWeight,
  restBetweenExercises,
  setGroups,
  setPrescription,
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

type Session = WorkoutRun;

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

  const [{ run: initial, resumed }] = useState(() => loadWorkoutRun(id));
  const [session, setSession] = useState(initial);
  // A sessão do servidor fica também no andamento, para a volta
  const joined = (sid: string) => {
    setSessionId(sid);
    setSession((s) => ({ ...s, serverSession: sid }));
  };
  const startAlone = () =>
    sessionActions.start.mutateAsync({ pageId: id, withUsers: [] }).then(joined, () => {});

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !online || !page) return;
    if (sessao) {
      started.current = true;
      sessionActions.join.mutateAsync(sessao).then(joined, () => {});
      return;
    }
    // Treino já começado (saiu para a lista e voltou): continua, sem perguntar de novo com quem.
    // Entra outra vez na mesma sessão; se ela acabou (todo mundo saiu), abre uma sozinho
    if (resumed) {
      started.current = true;
      const previous = initial.serverSession;
      if (previous) sessionActions.join.mutateAsync(previous).then(joined, startAlone);
      else startAlone();
      return;
    }
    // Em pasta compartilhada sempre pergunta (sozinho no grupo, o seletor oferece o convite)
    if (togetherFolder) return;
    started.current = true;
    startAlone();
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
      .then(joined, () => {})
      .finally(() => setPicked(true));
  }
  const picking = online && !sessao && !resumed && !picked && togetherFolder && !members.isPending;

  // Depois do fim, nada grava de novo (o XP da última série pode chegar com a tela saindo)
  const ended = useRef(false);
  useEffect(() => {
    if (!ended.current) saveWorkoutRun(id, session);
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
  // Aqui só importa se há descanso (a contagem fica na tela da série): sem o redesenho de 250 ms
  const activeTimer = useActiveTimer().data;
  const timerActions = useTimerActions();
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
    if (activeTimer?.kind === 'rest') timerActions.act(activeTimer, 'cancel').catch(() => {});
    let gone = false;
    const wait = new Promise((resolve) => setTimeout(resolve, 1500));
    void Promise.race([lastResult.current.catch(() => {}), wait]).then(() => {
      if (gone) return;
      const s = latest.current;
      toast({ message: finishedMessage(s, game.data?.enabled !== false, t, partnerNames) });
      ended.current = true;
      clearWorkoutRun(id);
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
      shared={others.length > 0}
      fresh={tasks.isFetchedAfterMount && !tasks.isFetching}
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
  shared,
  fresh,
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
  /** Pasta com mais gente: a progressão sugere em vez de mudar o plano de todos */
  shared: boolean;
  /** A lista foi lida de novo nesta abertura (antes disso, a progressão não mexe no plano) */
  fresh: boolean;
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
  // Séries avançadas: repetições e carga desta série (sem elas, as do item)
  const planned = setPrescription(meta, item.reps);
  // A série como aconteceu (AC4): vem com o previsto; o que a pessoa mudar vale só para ela
  const gymPrefs = useGymPrefs();
  const effortScale = gymPrefs.effort === 'off' ? null : gymPrefs.effort;
  const exercise = useExercise(task.exercise_id);
  const kind: SetKind = item.plan.mode === 'timed' ? 'time' : (exercise.data?.kind ?? 'reps');
  const setKey = `${task.id}:${item.reps}`;
  const blank: SetDraft = { reps: null, effort: null, distance: '', minutes: '' };
  const [draftState, setDraftState] = useState({ key: setKey, draft: blank });
  const stored = draftState.key === setKey ? draftState.draft : blank;
  const draft = { ...stored, reps: stored.reps ?? planned.reps ?? null };
  const km = parseDecimal(draft.distance);
  const minutes = parseDecimal(draft.minutes);
  const values: SetValues = {
    weight: planned.weight ?? null,
    reps: kind === 'reps' ? draft.reps : null,
    kind,
    ...(effortScale && draft.effort != null
      ? { effort: draft.effort, effort_scale: effortScale }
      : {}),
    ...(kind === 'cardio'
      ? {
          distance_m: km != null ? Math.round(km * 1000) : null,
          duration_seconds: minutes != null ? Math.round(minutes * 60) : null,
        }
      : {}),
  };
  const showSetRow =
    !item.done &&
    allowed.complete &&
    (kind === 'cardio' || planned.reps != null || !!task.exercise_id || !!effortScale);
  const toast = useToast();
  const { warmup } = useWorkoutSetActions();
  // Progressão (AC6.3): a carga do plano já vem com a prescrição (no treino pessoal, antes da
  // primeira série do exercício); em pasta com mais gente, só sugere, com "Usar"
  const progression = useProgression(task, { excludeToday: true });
  const why = useWhy();
  const prescribed = progression.prescription;
  const prescribedMeta =
    prescribed &&
    (prescribed.kind === 'up' || prescribed.kind === 'deload' || prescribed.kind === 'hold')
      ? prescriptionMeta(meta, prescribed, progression.plan.unit, !i18n.language.startsWith('en'))
      : null;
  const differs =
    !!prescribedMeta &&
    (prescribedMeta.weight !== meta.weight || prescribedMeta.reps !== meta.reps);
  const canApply =
    differs && allowed.edit && !item.done && item.reps === 0 && !setGroups(meta).length;
  const autoApply = canApply && fresh && progression.fresh && !shared;
  // Recordes (AC5): calculados aqui na hora, contra o diário deste exercício (o servidor confere
  // de novo e dá o crítico); as séries desta tela que o histórico ainda não trouxe entram junto
  const history = useWorkoutHistory({ exerciseId: task.exercise_id, taskId: task.id });
  const timeZone = useTimeZone();
  // (`seen`: a série mais nova do histórico quando esta foi feita; histórico mais novo já a traz)
  const loggedHere = useRef<(RecordSet & { seen: number; key: string })[]>([]);
  function checkRecords() {
    const known = history.data ?? [];
    const newest = known.length ? Date.parse(known[0].performed_at) : 0;
    const exerciseKey = task.exercise_id ?? task.id;
    const previous: RecordSet[] = [
      ...known.map((s) => ({ ...s, day: todayIn(timeZone, new Date(s.performed_at)) })),
      ...loggedHere.current.filter((s) => s.key === exerciseKey && s.seen >= newest),
    ];
    const next: RecordSet = {
      weight_kg: textToKg(values.weight),
      reps: values.reps ?? null,
      duration_seconds:
        values.duration_seconds ?? (kind === 'time' ? (item.plan.duration_seconds ?? null) : null),
      distance_m: values.distance_m ?? null,
      day: todayIn(timeZone),
    };
    const found = setRecords(previous, next);
    loggedHere.current.push({ ...next, seen: newest, key: exerciseKey });
    if (!found.length) return;
    toast({
      message: t('records.toast', { list: found.map((r) => t(`records.${r}`)).join(', ') }),
    });
    setSession((s) => ({ ...s, records: (s.records ?? 0) + 1 }));
  }

  const lb = parseWeight(planned.weight)?.unit.startsWith('lb');
  const step = lb ? 5 : 2.5;
  const decimalComma = !i18n.language.startsWith('en');

  /** Próximo depois deste, contando este como feito (a lista ainda não refletiu). */
  const following = (skipped = session.skipped) => {
    const after = items.map((it, i) => (i === index ? { ...it, done: true } : it));
    return nextPending(after, index + 1, skipped);
  };
  const advance = (skipped = session.skipped) => {
    const next = following(skipped);
    goTo(next === -1 ? null : next);
  };

  /**
   * Fim do exercício com outro pela frente: descanso antes do próximo (19/10). O `log_rep` só
   * começa o "depois" do plano, que o painel não grava; aqui vale também o das séries.
   */
  const restBeforeNext = (alreadyStarted: boolean) => {
    const next = following();
    const seconds = restBetweenExercises(item.plan, item.repeats);
    if (next === -1 || !seconds || alreadyStarted) return null;
    startTimer({
      kind: 'rest',
      seconds,
      taskId: task.id,
      config: { label: task.title, after: true },
    });
    return seconds;
  };

  function done() {
    if (paused || item.done || !allowed.complete) return false;
    const addXp = (xp: number | undefined) => xp && setSession((s) => ({ ...s, xp: s.xp + xp }));
    setSession((s) => ({
      ...s,
      sets: s.sets + 1,
      volume: s.volume + setVolume({ ...planned, reps: values.reps ?? undefined }),
    }));
    checkRecords();
    if (group) {
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
      const last = next >= item.plan.total;
      const between = item.repeats && !last ? restAfterRep(item.plan, next) : null;
      if (between)
        startTimer({
          kind: 'rest',
          seconds: between.seconds,
          taskId: task.id,
          config: {
            label: `${task.title}, ${Math.min(next + 1, item.plan.total)}/${item.plan.total}`,
          },
        });
      const restSeconds = between?.seconds ?? (last ? restBeforeNext(false) : null);
      if (restSeconds) {
        const iso = new Date(Date.now() + restSeconds * 1000).toISOString();
        onRestShared(iso);
        sessionActions.setState.mutate({ id: group.id, state: { rest_ends_at: iso } });
      }
      if (last) advance();
    } else if (item.repeats) {
      const { next, result } = logSet(task, item.plan, item.reps, 1, values);
      onResult(result);
      result.then(
        (r) => addXp(r?.summary?.xp),
        () => {},
      );
      if (next >= item.plan.total) {
        // O log_rep já começou o "depois" do plano, se houver
        restBeforeNext(!!item.plan.rest_after_seconds);
        advance();
      }
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
  const applied = useRef(new Set<string>());
  useEffect(() => {
    if (!autoApply || !prescribedMeta || applied.current.has(task.id)) return;
    applied.current.add(task.id);
    save({ meta: prescribedMeta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApply, task.id]);

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
  // Séries avançadas: o que esta série pede ("10 reps · 45kg")
  const advanced = setGroups(meta).length > 0;
  const setLabel = advanced
    ? [planned.reps ? t('workout.reps', { count: planned.reps }) : null, planned.weight]
        .filter(Boolean)
        .join(' · ')
    : '';

  // X1: a mesma série na tela de bloqueio, com os botões que não pedem para destravar
  const lockTitle = `${task.title}${setLabel || metaLabel(meta) ? ` · ${setLabel || metaLabel(meta)}` : ''}`;
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
        {setLabel && !item.done ? (
          <Text className="font-mono text-xl font-semibold text-ink">{setLabel}</Text>
        ) : null}
        {prescribed && !item.done && prescribed.kind !== 'off' && prescribed.kind !== 'first' ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm text-ink-muted">{why(prescribed, progression.plan.unit)}</Text>
            {shared && canApply && prescribedMeta && (
              <Button
                variant="ghost"
                label={t('progression.use')}
                onPress={() => save({ meta: prescribedMeta })}
              />
            )}
          </View>
        ) : null}
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

      {item.done ? (
        // Exercício já feito (voltou pelo "Anterior" ou outra pessoa terminou): segue para o
        // próximo pendente, em vez de um "Feita" apagado que deixava o treino parado
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.next')}
          onPress={() => {
            const next = nextPending(items, index + 1, session.skipped);
            goTo(next === -1 ? null : next);
          }}
          className="min-h-20 items-center justify-center rounded-lg bg-accent active:opacity-80"
        >
          <Text className="text-xl font-semibold text-paper">{t('workout.next')}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.done')}
          accessibilityHint={t(paused ? 'workout.pausedHint' : 'workout.doneHint')}
          aria-disabled={paused || !allowed.complete}
          disabled={paused || !allowed.complete}
          onPress={done}
          className={cn(
            'min-h-20 items-center justify-center rounded-lg bg-accent active:opacity-80',
            (paused || !allowed.complete) && 'opacity-40',
          )}
        >
          <Text className="text-xl font-semibold text-paper">{t('workout.done')}</Text>
          {paused && <Text className="text-sm text-paper">{t('workout.pausedHint')}</Text>}
        </Pressable>
      )}

      {showSetRow && (
        <SetRow
          kind={kind}
          draft={draft}
          effortScale={effortScale}
          disabled={paused}
          onChange={(next) => setDraftState({ key: setKey, draft: next })}
        />
      )}

      {(cards || planned.weight) && allowed.edit && !item.done && (
        <View className="flex-row items-center justify-center gap-3">
          <Button
            variant="ghost"
            label={`−${String(step).replace('.', decimalComma ? ',' : '.')}`}
            accessibilityLabel={t('workout.lighter')}
            onPress={() => save({ meta: adjustSetWeight(meta, item.reps, -step, decimalComma) })}
          />
          <Text
            className="min-w-20 text-center font-mono text-base text-ink"
            accessibilityLabel={t('workout.load', { weight: planned.weight ?? '—' })}
          >
            {planned.weight ?? '—'}
          </Text>
          <Button
            variant="ghost"
            label={`+${String(step).replace('.', decimalComma ? ',' : '.')}`}
            accessibilityLabel={t('workout.heavier')}
            onPress={() => save({ meta: adjustSetWeight(meta, item.reps, step, decimalComma) })}
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
        {showSetRow && kind === 'reps' && (
          <Button
            variant="ghost"
            label={t('diary.warmup')}
            accessibilityHint={t('diary.warmupHint')}
            disabled={paused}
            onPress={() =>
              warmup.mutateAsync({ task, values }).then(
                () => toast({ message: t('diary.warmupDone') }),
                () => {},
              )
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
    session.records ? t('records.summary', { count: session.records }) : null,
    game && session.xp > 0 ? `+${session.xp} XP` : null,
    session.skipped.length ? t('workout.toastSkipped', { count: session.skipped.length }) : null,
    partners.length ? t('together.with', { names: partners.join(', ') }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
