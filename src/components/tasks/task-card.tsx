import { memo } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import type { Task } from '@/lib/queries/tasks';
import { useCanWrite } from '@/providers/write';
import { DragHandle } from './sortable-tasks';
import { metaLabel } from './task-meta';
import { useToggleWithUndo } from './task-row';

/** Card grande (ESCOPO 4.3): o toque em qualquer parte marca/desmarca, com animação curta e vibração. */
function TaskCardView({
  task,
  subtasks,
}: {
  task: Task;
  subtasks?: { done: number; total: number };
}) {
  const writable = useCanWrite(task.folder_id, { offline: true });
  const toggle = useToggleWithUndo();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const done = task.status === 'done';
  const detail = [
    metaLabel(task.meta),
    subtasks?.total ? `☑ ${subtasks.done}/${subtasks.total}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={done}
        aria-disabled={!writable}
        accessibilityLabel={task.title}
        disabled={!writable}
        onPress={() => {
          // .set() em vez de "scale.value =": é o jeito compatível com o React Compiler
          scale.set(
            withSequence(withTiming(0.96, { duration: 70 }), withSpring(1, { damping: 12 })),
          );
          toggle(task, !done);
        }}
        className={cn(
          'min-h-24 flex-row items-center gap-2 rounded-2xl border-2 p-3 pl-1',
          done ? 'border-primary bg-primary/10' : 'border-border bg-card',
        )}
      >
        <DragHandle label={task.title} taskId={task.id} />
        <View className="flex-1 gap-1">
          <Text
            className={cn(
              'text-lg font-semibold',
              done ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
            numberOfLines={3}
          >
            {task.title}
          </Text>
          {detail ? <Text className="text-base text-muted-foreground">{detail}</Text> : null}
        </View>
        <View
          className={cn(
            'h-10 w-10 items-center justify-center rounded-full border-2',
            done ? 'border-primary bg-primary' : 'border-muted-foreground',
          )}
        >
          {done && <Text className="text-lg font-bold text-primary-foreground">✓</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Detalhes de ${task.title}`}
          className="h-11 w-8 items-center justify-center"
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        >
          <Text className="text-xl text-muted-foreground">›</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

/** Card memoizado, pelo mesmo motivo da TaskRow (D57). */
export const TaskCard = memo(
  TaskCardView,
  (a, b) =>
    a.task === b.task &&
    a.subtasks?.done === b.subtasks?.done &&
    a.subtasks?.total === b.subtasks?.total,
);
