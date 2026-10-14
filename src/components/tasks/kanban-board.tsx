import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { rewardMessage } from '@/lib/gamification';
import { useGameState } from '@/lib/queries/game';
import { useToday } from '@/lib/queries/profile';
import { useSetTaskStatus, type Task, type TaskStatus } from '@/lib/queries/tasks';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';
import { AssigneeChips } from './assignee-chips';
import { TaskMeta } from './task-meta';

const COLUMNS = [
  { status: 'todo', title: 'kanban.todo' },
  { status: 'doing', title: 'kanban.doing' },
  { status: 'done', title: 'kanban.done' },
] as const satisfies readonly { status: TaskStatus; title: string }[];
type Column = (typeof COLUMNS)[number];

/**
 * Kanban: A fazer / Fazendo / Feito. Mover é por botões (setas), que funcionam com
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
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const today = useToday();
  // A mutação fica no quadro (que continua montado): o card muda de coluna e é desmontado, e o
  // onSuccess de um mutate cujo componente saiu da tela não é chamado
  const setStatus = useSetTaskStatus();
  const toast = useToast();
  const game = useGameState();

  function move(task: Task, target: Column) {
    // mutateAsync: o card muda de coluna (desmonta) antes da resposta
    setStatus.mutateAsync({ id: task.id, status: target.status }).then(
      (summary) => {
        const reward =
          target.status === 'done' && summary && game.data?.enabled !== false
            ? rewardMessage(summary)
            : null;
        if (reward) toast({ message: t('kanban.doneToast', { title: task.title, reward }) });
      },
      () => {},
    );
  }

  const columns = COLUMNS.map((c) => ({
    ...c,
    tasks: tasks.filter((t) => t.status === c.status),
  }));

  const body = columns.map((column, index) => (
    <View
      key={column.status}
      accessibilityLabel={t('kanban.column', { title: t(column.title) })}
      className={cn('gap-2', wide ? 'flex-1' : '')}
      style={wide ? undefined : { width: Math.min(320, width * 0.8) }}
    >
      <SectionLabel title={t(column.title)} count={column.tasks.length} className="pt-0" />
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
        <Text className="py-3 text-xs text-ink-muted">{t('kanban.empty')}</Text>
      )}
    </View>
  ));

  return wide ? (
    <View className="flex-row items-start gap-6 pt-2">{body}</View>
  ) : (
    <ScrollView
      horizontal
      contentContainerClassName="gap-6 pt-2"
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
  prev?: Column;
  next?: Column;
  onMove: (target: Column) => void;
}) {
  const { t } = useTranslation();
  const writable = useCanWrite(folderId, { offline: true });

  return (
    <View className="gap-2 rounded-lg border border-line bg-surface p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('task.details', { title: task.title })}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text
          className={cn(
            'text-sm',
            task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
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
              icon={ChevronLeft}
              label={t(prev.title)}
              a11y={t('kanban.move', { title: task.title, column: t(prev.title) })}
              onPress={() => move(prev)}
            />
          ) : (
            <View />
          )}
          {next && (
            <MoveButton
              icon={ChevronRight}
              trailing
              label={t(next.title)}
              a11y={t('kanban.move', { title: task.title, column: t(next.title) })}
              onPress={() => move(next)}
            />
          )}
        </View>
      )}
    </View>
  );
}

function MoveButton({
  icon,
  trailing,
  label,
  a11y,
  onPress,
}: {
  icon: LucideIcon;
  trailing?: boolean;
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      className={cn(
        'min-h-11 items-center gap-1 rounded px-1 hover:bg-wash active:bg-wash md:min-h-8',
        trailing ? 'flex-row-reverse' : 'flex-row',
      )}
      onPress={onPress}
    >
      <Icon icon={icon} tone="ink-muted" />
      <Text className="text-xs text-ink-muted">{label}</Text>
    </Pressable>
  );
}
