import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { ChevronLeft, ChevronRight, Pencil, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
 * Kanban: A fazer / Fazendo / Feito. Mover é arrastando o card para outra coluna ou pelos
 * botões (setas), que funcionam com toque, teclado e leitor de tela; levar para Feito conclui
 * a tarefa (XP, bosses).
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

  // Arrastar (pedido do dono, 20/10): soltar o card sobre outra coluna move a tarefa. A coluna é
  // achada pela posição na janela no momento de soltar (o quadro pode estar rolado de lado)
  const columnRefs = useRef<(View | null)[]>([]);
  const [hover, setHover] = useState<TaskStatus | null>(null);
  const columnAt = (x: number) =>
    Promise.all(
      COLUMNS.map(
        (c, i) =>
          new Promise<Column | null>((resolve) => {
            const ref = columnRefs.current[i];
            if (!ref) return resolve(null);
            ref.measureInWindow((left, _top, w) => resolve(x >= left && x <= left + w ? c : null));
          }),
      ),
    ).then((found) => found.find(Boolean) ?? null);
  const dragTo = (task: Task, x: number) =>
    columnAt(x).then((target) => {
      setHover(null);
      if (target && target.status !== task.status) move(task, target);
    });
  const dragOver = (x: number) => columnAt(x).then((c) => setHover(c?.status ?? null));

  const body = columns.map((column, index) => (
    <View
      key={column.status}
      ref={(el) => {
        columnRefs.current[index] = el;
      }}
      accessibilityLabel={t('kanban.column', { title: t(column.title) })}
      className={cn(
        'gap-2 rounded-lg',
        wide ? 'flex-1' : '',
        hover === column.status && 'bg-accent-soft',
      )}
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
          onDragOver={dragOver}
          onDrop={(x) => dragTo(task, x)}
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
  onDragOver,
  onDrop,
}: {
  task: Task;
  today: string;
  folderId: string;
  subtasks?: { done: number; total: number };
  prev?: Column;
  next?: Column;
  onMove: (target: Column) => void;
  /** Arrastando: a posição x na janela (para acender a coluna de baixo) */
  onDragOver: (x: number) => void;
  /** Soltou na posição x da janela */
  onDrop: (x: number) => void;
}) {
  const { t } = useTranslation();
  const writable = useCanWrite(folderId, { offline: true });
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const dragging = useSharedValue(false);
  // No celular, toque longo (o quadro rola de lado e o toque abre a tarefa); no navegador, basta
  // começar a arrastar com o mouse
  const pan = Gesture.Pan()
    .enabled(writable)
    .onStart(() => {
      dragging.set(true);
    })
    .onUpdate((e) => {
      dx.set(e.translationX);
      dy.set(e.translationY);
      runOnJS(onDragOver)(e.absoluteX);
    })
    .onEnd((e) => {
      runOnJS(onDrop)(e.absoluteX);
    })
    .onFinalize(() => {
      dx.set(withTiming(0));
      dy.set(withTiming(0));
      dragging.set(false);
    });
  if (Platform.OS === 'web') pan.minDistance(8);
  else pan.activateAfterLongPress(300);
  const lifted = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }],
    zIndex: dragging.get() ? 10 : 0,
    opacity: dragging.get() ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={lifted}>
        <KanbanCardBody
          task={task}
          today={today}
          subtasks={subtasks}
          prev={prev}
          next={next}
          writable={writable}
          move={move}
          t={t}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function KanbanCardBody({
  task,
  today,
  subtasks,
  prev,
  next,
  writable,
  move,
  t,
}: {
  task: Task;
  today: string;
  subtasks?: { done: number; total: number };
  prev?: Column;
  next?: Column;
  writable: boolean;
  move: (target: Column) => void;
  t: TFunction;
}) {
  return (
    // Classes do NativeWind não pegam no Animated.View: o visual fica neste View de dentro
    <View className="gap-2 rounded-lg border border-line bg-surface p-3">
      {/* O título não abre a tarefa: arrastar começando por ele soltava e abria o painel. Editar é pelo
          lápis */}
      <View className="flex-row items-start gap-2">
        <Text
          className={cn(
            'flex-1 text-sm',
            task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {task.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('task.details', { title: task.title })}
          hitSlop={8}
          className="-m-1 rounded p-1 hover:bg-wash active:bg-wash"
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        >
          <Icon icon={Pencil} size={16} tone="ink-muted" />
        </Pressable>
      </View>
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
