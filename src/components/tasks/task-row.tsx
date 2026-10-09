import { router } from 'expo-router';
import { memo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { useGameState } from '@/lib/queries/game';
import { formatDueDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { advanceOnComplete, useToggleTask, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useCanWrite } from '@/providers/write';
import { useToast } from '@/providers/toast';
import { AssigneeChips } from './assignee-chips';
import { DragHandle } from './sortable-tasks';
import { TaskMeta } from './task-meta';

/**
 * Marcar/desmarcar com aviso de "Desfazer" (o mesmo uncomplete_task, ESCOPO 4.6 item 5) e vibração leve.
 * Recorrente comum só avança a data (D25); o aviso mostra a próxima.
 */
export function useToggleWithUndo() {
  const toggle = useToggleTask();
  const toast = useToast();
  const tree = useTree();
  const today = useToday();
  const game = useGameState();
  return (task: Task, done: boolean) => {
    const page = tree.data?.pages.find((p) => p.id === task.page_id);
    const nextDue = done ? advanceOnComplete(task, page, today) : null;
    if (done && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!done) {
      toggle.mutate({ id: task.id, done });
      return;
    }
    const message = nextDue
      ? `Feito! Próxima: ${formatDueDate(nextDue, today)}`
      : `Concluída: ${task.title}`;
    const undo = { label: 'Desfazer', onPress: () => toggle.mutate({ id: task.id, done: false }) };
    toast({ message, action: undo });
    toggle.mutate(
      { id: task.id, done, nextDue },
      {
        // A recompensa (Fase 3) entra no mesmo aviso, sem perder o "Desfazer"
        onSuccess: (summary) => {
          const reward = summary && game.data?.enabled !== false ? rewardMessage(summary) : null;
          if (reward) toast({ message: `${message} · ${reward}`, action: undo });
        },
      },
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
  const writable = useCanWrite(task.folder_id, { offline: true });
  const toggle = useToggleWithUndo();
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.status === 'done';

  function saveTitle() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title)
      update.mutate({ id: task.id, patch: { title: trimmed } });
    else setTitle(task.title);
  }

  return (
    <View className="min-h-14 flex-row items-center border-b border-border bg-background">
      {draggable && <DragHandle label={task.title} taskId={task.id} />}
      <Checkbox
        checked={done}
        disabled={!writable}
        label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
        onChange={(checked) => toggle(task, checked)}
      />
      <View className="flex-1 py-2">
        {editing ? (
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={saveTitle}
            onBlur={saveTitle}
            maxLength={500}
            accessibilityLabel="Título da tarefa"
            className="min-h-8 text-base text-foreground"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Toque para editar o título"
            disabled={!writable}
            onPress={() => {
              setTitle(task.title);
              setEditing(true);
            }}
          >
            <Text
              className={cn(
                'text-base',
                done ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {task.title}
            </Text>
          </Pressable>
        )}
        <TaskMeta task={task} today={today} subtasks={subtasks} pageLabel={pageLabel} />
        <AssigneeChips taskId={task.id} folderId={task.folder_id} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${task.title}`}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text className="text-xl text-muted-foreground">›</Text>
      </Pressable>
    </View>
  );
}

type Subtasks = { done: number; total: number } | undefined;
const sameSubtasks = (a: Subtasks, b: Subtasks) => a?.done === b?.done && a?.total === b?.total;

/**
 * Linha de tarefa memoizada (D57): numa lista de 500, marcar uma não re-renderiza as outras 499.
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
