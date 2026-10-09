import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { AnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { positionAfterMove } from '@/lib/positions';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useCanWrite } from '@/providers/write';

/** Alça de arrastar (⠿). Só ela inicia o arrasto, para o toque no resto do item continuar funcionando. */
export function DragHandle({ label }: { label: string }) {
  return (
    <Sortable.Handle>
      <View
        accessibilityLabel={`Arrastar ${label}`}
        accessibilityHint="Segure e arraste para mudar a ordem"
        className="h-11 w-8 items-center justify-center"
      >
        <Text className="text-lg text-muted-foreground">⠿</Text>
      </View>
    </Sortable.Handle>
  );
}

/**
 * Tarefas reordenáveis por arrasto (lista e cards). Ao soltar, só a tarefa movida ganha posição nova
 * (no meio das vizinhas). Precisa estar dentro de um Animated.ScrollView (scrollRef) para rolar sozinho.
 */
export function SortableTasks({
  tasks,
  columns = 1,
  gap = 0,
  scrollRef,
  renderTask,
}: {
  tasks: Task[];
  columns?: number;
  gap?: number;
  scrollRef: AnimatedRef<any>;
  renderTask: (task: Task) => ReactNode;
}) {
  const update = useUpdateTask();
  const writable = useCanWrite(tasks[0]?.folder_id, { offline: true });

  return (
    <Sortable.Grid
      data={tasks}
      keyExtractor={(t) => t.id}
      columns={columns}
      rowGap={gap}
      columnGap={gap}
      customHandle
      sortEnabled={writable}
      scrollableRef={scrollRef}
      autoScrollActivationOffset={80}
      activeItemScale={1.02}
      inactiveItemOpacity={1}
      onDragEnd={({ fromIndex, toIndex }) => {
        if (fromIndex === toIndex) return;
        const position = positionAfterMove(
          tasks.map((t) => t.position),
          fromIndex,
          toIndex,
        );
        update.mutate({ id: tasks[fromIndex].id, patch: { position } });
      }}
      // A lib pode renderizar uma vez com a lista antiga quando os dados trocam (ex.: cache → servidor)
      renderItem={({ item }) => (item ? <>{renderTask(item)}</> : null)}
    />
  );
}
