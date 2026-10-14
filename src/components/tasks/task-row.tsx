import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';
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
import { advanceOnComplete, useToggleTask, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useSelection, selection } from '@/lib/selection';
import { DURATION } from '@/lib/tokens';
import { useTaskCan } from '@/providers/write';
import { useToast } from '@/providers/toast';
import { AssigneeChips } from './assignee-chips';
import { DragHandle } from './sortable-tasks';
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
}: {
  task: Task;
  today: string;
  subtasks?: { done: number; total: number };
  pageLabel?: string;
  /** Mostra a alça de arrastar (só dentro de SortableTasks) */
  draggable?: boolean;
}) {
  const allowed = useTaskCan(task);
  const toggle = useToggleWithUndo();
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
      <Checkbox
        checked={done}
        disabled={!allowed.complete}
        label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
        onChange={(checked) => toggle(task, checked)}
      />
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
                {task.title}
              </Text>
              <PenStrike done={done} />
            </Pressable>
          )}
        </View>
        <View className="flex-row items-center gap-3 md:ml-auto">
          <TaskMeta task={task} today={today} subtasks={subtasks} pageLabel={pageLabel} />
          <AssigneeChips taskId={task.id} folderId={task.folder_id} />
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
    sameSubtasks(a.subtasks, b.subtasks),
);
