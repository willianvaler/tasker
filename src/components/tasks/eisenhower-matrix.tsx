import { Move } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { ActionMenu } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { moveToQuadrant, QUADRANTS, splitByQuadrant, type Quadrant } from '@/lib/eisenhower';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useTaskCan } from '@/providers/write';
import { TaskRow } from './task-row';

/**
 * Matriz de Eisenhower (D221): as tarefas abertas da página em quatro quadrantes, lidos da
 * prioridade e da data. Mover de quadrante é por menu (toque, teclado e leitor de tela).
 */
export function EisenhowerMatrix({
  tasks,
  today,
  subtaskCount,
}: {
  tasks: Task[];
  today: string;
  subtaskCount: Map<string, { done: number; total: number }>;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  // A mutação fica na matriz: a linha muda de quadrante (desmonta) antes da resposta
  const update = useUpdateTask();
  const [moving, setMoving] = useState<Task | null>(null);
  const split = splitByQuadrant(tasks, today);

  function move(task: Task, target: Quadrant) {
    const patch = moveToQuadrant(task, target, today);
    if (Object.keys(patch).length) update.mutate({ id: task.id, patch });
  }

  return (
    <View className={cn('gap-6 pt-2', wide && 'flex-row flex-wrap')}>
      {QUADRANTS.map((q) => (
        <View
          key={q}
          accessibilityLabel={t('matrix.quadrant', { title: t(`matrix.${q}`) })}
          className={cn('gap-1 rounded-lg border border-line p-3', wide && 'basis-[47%] grow')}
        >
          <SectionLabel title={t(`matrix.${q}`)} count={split[q].length} className="pt-0" />
          <Text className="text-xs text-ink-muted">{t(`matrix.${q}Hint`)}</Text>
          {split[q].map((task) => (
            <View key={task.id} className="flex-row items-center">
              <View className="flex-1">
                <TaskRow task={task} today={today} subtasks={subtaskCount.get(task.id)} />
              </View>
              <MoveToQuadrant task={task} onPress={() => setMoving(task)} />
            </View>
          ))}
          {split[q].length === 0 && (
            <Text className="py-3 text-xs text-ink-muted">{t('matrix.empty')}</Text>
          )}
        </View>
      ))}
      {moving && (
        <ActionMenu
          title={t('matrix.moveTitle', { title: moving.title })}
          onClose={() => setMoving(null)}
          actions={QUADRANTS.filter((q) => q !== splitOf(split, moving)).map((q) => ({
            label: t(`matrix.${q}`),
            onPress: () => move(moving, q),
          }))}
        />
      )}
    </View>
  );
}

function splitOf(split: Record<Quadrant, Task[]>, task: Task) {
  return QUADRANTS.find((q) => split[q].some((x) => x.id === task.id));
}

function MoveToQuadrant({ task, onPress }: { task: Task; onPress: () => void }) {
  const { t } = useTranslation();
  const can = useTaskCan(task);
  if (!can.edit) return null;
  return (
    <IconButton icon={Move} label={t('matrix.move', { title: task.title })} onPress={onPress} />
  );
}
