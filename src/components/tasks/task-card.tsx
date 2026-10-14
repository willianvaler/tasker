import { memo } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from '@/components/ui/button';
import { StampBox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Task } from '@/lib/queries/tasks';
import { DURATION, useColors } from '@/lib/tokens';
import { useCanWrite } from '@/providers/write';
import { DragHandle } from './sortable-tasks';
import { metaLabel } from './task-meta';
import { useToggleWithUndo } from './task-row';

/**
 * Card: o toque em qualquer parte marca/desmarca, com
 * o carimbo e um aperto curto. Borda fina, cantos de 8 px; feito, a borda vai para o acento.
 */
function TaskCardView({
  task,
  subtasks,
}: {
  task: Task;
  subtasks?: { done: number; total: number };
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const writable = useCanWrite(task.folder_id, { offline: true });
  const toggle = useToggleWithUndo();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const done = task.status === 'done';
  const detail = [metaLabel(task.meta), subtasks?.total ? `${subtasks.done}/${subtasks.total}` : '']
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
          if (!reduced)
            scale.set(
              withSequence(
                withTiming(0.97, { duration: DURATION.fast }),
                withTiming(1, { duration: DURATION.base }),
              ),
            );
          toggle(task, !done);
        }}
        className={cn(
          'min-h-[72px] flex-row items-center gap-2 rounded-lg border bg-surface py-3 pl-1 pr-1 hover:border-ink-muted',
          done ? 'border-accent' : 'border-line',
        )}
      >
        <DragHandle label={task.title} taskId={task.id} />
        <View className="flex-1 gap-1">
          <Text
            className={cn(
              'text-base font-semibold',
              done ? 'text-ink-muted line-through' : 'text-ink',
            )}
            style={done ? { textDecorationColor: colors.accent } : undefined}
            numberOfLines={3}
          >
            {task.title}
          </Text>
          {detail ? <Text className="font-mono text-xs text-ink-muted">{detail}</Text> : null}
        </View>
        <StampBox checked={done} size={24} />
        <IconButton
          icon={ChevronRight}
          label={t('task.details', { title: task.title })}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        />
      </Pressable>
    </Animated.View>
  );
}

/** Card memoizado, pelo mesmo motivo da TaskRow. */
export const TaskCard = memo(
  TaskCardView,
  (a, b) =>
    a.task === b.task &&
    a.subtasks?.done === b.subtasks?.done &&
    a.subtasks?.total === b.subtasks?.total,
);
