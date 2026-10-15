import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronRight, Clock, Lock } from 'lucide-react-native';
import { Platform, Pressable, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text, textClass } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { useGameState } from '@/lib/queries/game';
import { formatDueDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import {
  advanceOnComplete,
  useCompleteTree,
  useToggleTask,
  useUpdateTask,
  type Task,
} from '@/lib/queries/tasks';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { useTree } from '@/lib/queries/tree';
import { useSelection, selection } from '@/lib/selection';
import { treeState, useIsExpanded } from '@/lib/tree-state';
import { sameFlow, type RowFlow } from '@/lib/flow';
import { useForceTask } from '@/lib/queries/dependencies';
import { Icon } from '@/components/ui/icon';
import { DURATION } from '@/lib/tokens';
import { useTaskCan } from '@/providers/write';
import { useToast } from '@/providers/toast';
import { AssigneeChips, ClaimButton } from './assignee-chips';
import { DragHandle } from './sortable-tasks';
import { RepeatButton } from './repeat';
import { SnoozeButton } from './snooze';
import { TaskMeta } from './task-meta';

/**
 * Marcar/desmarcar com aviso de "Desfazer" e vibração leve.
 * Recorrente comum só avança a data; o aviso mostra a próxima.
 */
export function useToggleWithUndo() {
  const toggle = useToggleTask();
  const toast = useToast();
  const tree = useTree();
  const today = useToday();
  const game = useGameState();
  const { t } = useTranslation();
  return (task: Task, done: boolean) => {
    const page = tree.data?.pages.find((p) => p.id === task.page_id);
    const nextDue = done ? advanceOnComplete(task, page, today) : null;
    if (done && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!done) {
      toggle.mutate({ id: task.id, done });
      return;
    }
    const message = nextDue
      ? t('task.doneNext', { date: formatDueDate(nextDue, today) })
      : t('task.done', { title: task.title });
    const undo = {
      label: t('common.undo'),
      onPress: () => toggle.mutate({ id: task.id, done: false }),
    };
    toast({ message, action: undo });
    // A recompensa entra no mesmo aviso, sem perder o "Desfazer". mutateAsync, não onSuccess: a
    // linha concluída pode sair da lista antes da resposta, e o onSuccess de quem desmontou não roda
    toggle.mutateAsync({ id: task.id, done, nextDue }).then(
      (summary) => {
        const reward = summary && game.data?.enabled !== false ? rewardMessage(summary) : null;
        if (reward) toast({ message: `${message} · ${reward}`, action: undo });
      },
      () => {},
    );
  };
}

function TaskRowView({
  task,
  today,
  subtasks,
  pageLabel,
  draggable,
  level = 1,
  gutter,
  code,
  flow,
}: {
  task: Task;
  today: string;
  subtasks?: { done: number; total: number };
  pageLabel?: string;
  /** Mostra a alça de arrastar (só dentro de SortableTasks) */
  draggable?: boolean;
  /** Nível na árvore (1 = raiz): o recuo da linha */
  level?: number;
  /** Lista com árvore: reserva o lugar da seta mesmo sem filhas, para alinhar */
  gutter?: boolean;
  /** Código WBS ("1.2"), mostrado quando os códigos estão ligados */
  code?: string;
  /** Estado no fluxo (só para tarefas com pré-requisitos) */
  flow?: RowFlow;
}) {
  const allowed = useTaskCan(task);
  const expanded = useIsExpanded(task.id);
  const hasChildren = !!subtasks?.total;
  const toggle = useToggleWithUndo();
  const [confirmAll, setConfirmAll, closeConfirmAll] = useDialog<true>();
  const [confirmForce, setConfirmForce, closeConfirmForce] = useDialog<true>();
  const blocked = flow?.state === 'blocked';
  // Bloqueada: no estrito não se conclui; no flexível, quem pode, força (com confirmação)
  const canComplete = allowed.complete && (!blocked || !!flow?.forceable);
  const openLeaves = subtasks ? subtasks.total - subtasks.done : 0;
  const update = useUpdateTask();
  const { t } = useTranslation();
  const [localEditing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.status === 'done';
  // Seleção e F2 vêm do store da lista (só esta linha re-renderiza quando muda)
  const selected = useSelection((s) => s.selectedId === task.id);
  const editRequested = useSelection((s) => s.editId === task.id);
  const editing = localEditing || editRequested;

  function stopEditing() {
    setEditing(false);
    if (selection.get().editId === task.id) selection.edit(null);
  }

  function saveTitle() {
    stopEditing();
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title)
      update.mutate({ id: task.id, patch: { title: trimmed } });
    else setTitle(task.title);
  }

  function cancelTitle() {
    stopEditing();
    setTitle(task.title);
  }

  return (
    // 52 px no celular, 40 no computador; só a divisória fina, sem caixa
    <Pressable
      // Toque/clique na linha (fora do título e dos botões) seleciona, para os atalhos de teclado
      accessible={false}
      onPress={() => selection.select(task.id)}
      className={cn(
        'min-h-[52px] flex-row items-center border-b border-line md:min-h-10',
        selected && 'bg-wash',
      )}
    >
      {selected && <View className="absolute bottom-0 left-0 top-0 w-0.5 bg-accent" />}
      {draggable && <DragHandle label={task.title} taskId={task.id} />}
      {level > 1 && <View style={{ width: (level - 1) * 20 }} />}
      {hasChildren ? (
        <IconButton
          icon={expanded ? ChevronDown : ChevronRight}
          label={t(expanded ? 'tree.collapse' : 'tree.expand', { title: task.title })}
          aria-expanded={expanded}
          onPress={() => treeState.toggle(task.id)}
        />
      ) : (
        // Mantém o alinhamento com as linhas que têm seta
        (gutter || level > 1) && <View className="w-11 md:w-8" />
      )}
      <Checkbox
        checked={done}
        disabled={!canComplete}
        label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
        // Mãe com filhas abertas: pergunta antes de concluir o galho inteiro
        onChange={(checked) =>
          checked && blocked
            ? setConfirmForce(true)
            : checked && openLeaves > 0
              ? setConfirmAll(true)
              : toggle(task, checked)
        }
      />
      {confirmForce && flow && <ForceDialog task={task} flow={flow} onClose={closeConfirmForce} />}
      {confirmAll && (
        <CompleteAllDialog task={task} openLeaves={openLeaves} onClose={closeConfirmAll} />
      )}
      <View className="flex-1 justify-center gap-1 py-1 md:flex-row md:items-center md:gap-3">
        <View className="flex-1 md:flex-initial md:shrink">
          {editing ? (
            <TextInput
              autoFocus
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={saveTitle}
              onBlur={saveTitle}
              onKeyPress={(e) => e.nativeEvent.key === 'Escape' && cancelTitle()}
              selectTextOnFocus
              maxLength={500}
              accessibilityLabel={t('task.titleField')}
              className={textClass('min-h-8 text-base text-ink md:text-sm')}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('task.editHint')}
              disabled={!allowed.edit}
              className="self-start"
              onPress={() => {
                setTitle(task.title);
                setEditing(true);
              }}
            >
              <Text
                numberOfLines={2}
                className={cn('text-base md:text-sm', done ? 'text-ink-muted' : 'text-ink')}
              >
                {code ? <Text className="font-mono text-xs text-ink-muted">{code} </Text> : null}
                {task.title}
              </Text>
              <PenStrike done={done} />
            </Pressable>
          )}
          {flow && !done && <FlowLine flow={flow} />}
        </View>
        <View className="flex-row items-center gap-3 md:ml-auto">
          {task.repeat_plan && !hasChildren ? (
            <RepeatButton task={task} disabled={!canComplete || blocked} />
          ) : null}
          {!done && allowed.edit && task.due_date && task.due_date <= today && !hasChildren ? (
            <SnoozeButton task={task} />
          ) : null}
          <TaskMeta task={task} today={today} subtasks={subtasks} pageLabel={pageLabel} />
          <AssigneeChips taskId={task.id} folderId={task.folder_id} />
          {!done && !hasChildren ? <ClaimButton task={task} /> : null}
        </View>
      </View>
      <IconButton
        icon={ChevronRight}
        label={t('task.details', { title: task.title })}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      />
    </Pressable>
  );
}

/**
 * Risco de caneta sobre o título ao concluir: uma linha no acento que atravessa
 * o texto em 180 ms. Já concluída ao abrir a tela, aparece pronta; com "reduzir movimento", direto.
 */
function PenStrike({ done }: { done: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    const to = done ? 1 : 0;
    progress.set(reduced || !done ? to : withTiming(to, { duration: DURATION.slow }));
  }, [done, reduced, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: '50%', height: 1.5 }, style]}
    >
      <View className="h-full bg-accent" />
    </Animated.View>
  );
}

type Subtasks = { done: number; total: number } | undefined;
const sameSubtasks = (a: Subtasks, b: Subtasks) => a?.done === b?.done && a?.total === b?.total;

/**
 * Linha de tarefa memoizada: numa lista de 500, marcar uma não re-renderiza as outras 499.
 * As tarefas que não mudaram mantêm o mesmo objeto (patchTaskLists); `subtasks` é recriado a cada
 * mudança, então compara pelo conteúdo.
 */
export const TaskRow = memo(
  TaskRowView,
  (a, b) =>
    a.task === b.task &&
    a.today === b.today &&
    a.pageLabel === b.pageLabel &&
    a.draggable === b.draggable &&
    a.level === b.level &&
    a.gutter === b.gutter &&
    a.code === b.code &&
    sameFlow(a.flow, b.flow) &&
    sameSubtasks(a.subtasks, b.subtasks),
);

/** Estado no fluxo: cadeado e o que ela espera, ponto verde quando pronta, relógio em andamento. */
function FlowLine({ flow }: { flow: RowFlow }) {
  const { t, i18n } = useTranslation();
  if (flow.state === 'blocked') {
    const time = flow.readyAt
      ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(
          new Date(flow.readyAt),
        )
      : null;
    return (
      <View className="flex-row items-center gap-1" accessibilityLabel={t('flow.locked')}>
        <Icon icon={Lock} size={16} tone="ink-muted" />
        <Text className="text-xs text-ink-muted" numberOfLines={1}>
          {time
            ? t('flow.readyAt', { time })
            : t('flow.blocked', { names: flow.waiting.join(', ') })}
        </Text>
      </View>
    );
  }
  if (flow.state === 'doing')
    return (
      <View className="flex-row items-center gap-1">
        <Icon icon={Clock} size={16} tone="accent" />
        <Text className="text-xs text-accent">{t('flow.doing')}</Text>
      </View>
    );
  return (
    <View className="flex-row items-center gap-1">
      <View className="h-2 w-2 rounded-full bg-ok" />
      <Text className="text-xs text-ok">{t('flow.ready')}</Text>
    </View>
  );
}

// Os diálogos têm as próprias mutações: assim cada linha da lista não cria duas mutações que
// quase nunca usa (500 linhas = 1.000 observadores a mais)
function CompleteAllDialog({
  task,
  openLeaves,
  onClose,
}: {
  task: Task;
  openLeaves: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const completeTree = useCompleteTree();
  return (
    <ConfirmDialog
      title={t('task.completeAllTitle', { title: task.title })}
      message={t('task.completeAllMessage', { count: openLeaves })}
      confirmLabel={t('task.completeAll')}
      onClose={onClose}
      onConfirm={() => {
        onClose();
        completeTree.mutate(task.id);
      }}
    />
  );
}

function ForceDialog({ task, flow, onClose }: { task: Task; flow: RowFlow; onClose: () => void }) {
  const { t } = useTranslation();
  const force = useForceTask();
  const toast = useToast();
  return (
    <ConfirmDialog
      title={t('flow.forceTitle', { title: task.title })}
      message={t('flow.forceMessage', { names: flow.waiting.join(', ') })}
      confirmLabel={t('flow.force')}
      onClose={onClose}
      onConfirm={() => {
        onClose();
        force.mutate(
          { id: task.id, action: 'complete' },
          { onError: (err) => toast({ message: err.message }) },
        );
      }}
    />
  );
}
