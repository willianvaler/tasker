import { router } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { useGameState } from '@/lib/queries/game';
import { useToday } from '@/lib/queries/profile';
import { useSetTaskStatus, type Task, type TaskStatus } from '@/lib/queries/tasks';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';
import { AssigneeChips } from './assignee-chips';
import { TaskMeta } from './task-meta';

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'A fazer' },
  { status: 'doing', title: 'Fazendo' },
  { status: 'done', title: 'Feito' },
];

/**
 * Kanban (ESCOPO 3): A fazer / Fazendo / Feito. Mover é por botões (◀ ▶), que funcionam com
 * toque, teclado e leitor de tela; levar para Feito conclui a tarefa (XP, bosses).
 */
export function KanbanBoard({
  tasks,
  folderId,
  subtaskCount,
}: {
  tasks: Task[];
  folderId: string;
  subtaskCount: Map<string, { done: number; total: number }>;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const today = useToday();
  // A mutação fica no quadro (que continua montado): o card muda de coluna e é desmontado, e o
  // onSuccess de um mutate cujo componente saiu da tela não é chamado
  const setStatus = useSetTaskStatus();
  const toast = useToast();
  const game = useGameState();

  function move(task: Task, target: { status: TaskStatus; title: string }) {
    setStatus.mutate(
      { id: task.id, status: target.status },
      {
        onSuccess: (summary) => {
          const reward =
            target.status === 'done' && summary && game.data?.enabled !== false
              ? rewardMessage(summary)
              : null;
          if (reward) toast({ message: `Feito: ${task.title} · ${reward}` });
        },
      },
    );
  }

  const columns = COLUMNS.map((c) => ({
    ...c,
    tasks: tasks.filter((t) => t.status === c.status),
  }));

  const body = columns.map((column, index) => (
    <View
      key={column.status}
      accessibilityLabel={`Coluna ${column.title}`}
      className={cn('gap-2 rounded-xl bg-muted p-2', wide ? 'flex-1' : '')}
      style={wide ? undefined : { width: Math.min(320, width * 0.8) }}
    >
      <Text className="px-1 text-sm font-semibold text-muted-foreground">
        {column.title} ({column.tasks.length})
      </Text>
      {column.tasks.map((task) => (
        <KanbanCard
          key={task.id}
          task={task}
          today={today}
          folderId={folderId}
          subtasks={subtaskCount.get(task.id)}
          prev={COLUMNS[index - 1]}
          next={COLUMNS[index + 1]}
          onMove={(target) => move(task, target)}
        />
      ))}
      {column.tasks.length === 0 && (
        <Text className="px-1 py-3 text-xs text-muted-foreground">Nada aqui.</Text>
      )}
    </View>
  ));

  return wide ? (
    <View className="flex-row items-start gap-3 pt-2">{body}</View>
  ) : (
    <ScrollView
      horizontal
      contentContainerClassName="gap-3 pt-2"
      showsHorizontalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}

function KanbanCard({
  task,
  today,
  folderId,
  subtasks,
  prev,
  next,
  onMove: move,
}: {
  task: Task;
  today: string;
  folderId: string;
  subtasks?: { done: number; total: number };
  prev?: { status: TaskStatus; title: string };
  next?: { status: TaskStatus; title: string };
  onMove: (target: { status: TaskStatus; title: string }) => void;
}) {
  const writable = useCanWrite(folderId, { offline: true });

  return (
    <View className="gap-1 rounded-lg border border-border bg-background p-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${task.title}`}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text
          className={cn(
            'text-base',
            task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {task.title}
        </Text>
      </Pressable>
      <TaskMeta task={task} today={today} subtasks={subtasks} />
      <AssigneeChips taskId={task.id} folderId={task.folder_id} />
      {writable && (
        <View className="flex-row justify-between">
          {prev ? (
            <MoveButton
              label={`◀ ${prev.title}`}
              a11y={`Mover ${task.title} para ${prev.title}`}
              onPress={() => move(prev)}
            />
          ) : (
            <View />
          )}
          {next && (
            <MoveButton
              label={`${next.title} ▶`}
              a11y={`Mover ${task.title} para ${next.title}`}
              onPress={() => move(next)}
            />
          )}
        </View>
      )}
    </View>
  );
}

function MoveButton({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      className="min-h-11 justify-center rounded-md px-2 active:bg-muted"
      onPress={onPress}
    >
      <Text className="text-xs font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}
