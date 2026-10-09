import { createContext, useContext, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import type { AnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { positionAfterMove } from '@/lib/positions';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useCanWrite } from '@/providers/write';

/** Acima disto, a lista não usa a grade de arrastar (performance, D57). */
export const SORTABLE_LIMIT = 100;

/** Move a tarefa uma casa para cima (-1) ou para baixo (+1), sem arrastar. */
const MoveContext = createContext<((taskId: string, delta: -1 | 1) => void) | null>(null);
/** A alça só vira alça de arrasto dentro da grade (Sortable.Handle quebra fora dela). */
const InGrid = createContext(false);

/**
 * Alça de arrastar (⠿). Só ela inicia o arrasto, para o toque no resto do item continuar funcionando.
 * Sem arrastar também dá (ESCOPO 5, acessibilidade): na web, foco na alça e setas ↑ ↓; no celular,
 * as ações "mover para cima/baixo" do leitor de tela (TalkBack, VoiceOver).
 */
export function DragHandle({ label, taskId }: { label: string; taskId?: string }) {
  const move = useContext(MoveContext);
  const inGrid = useContext(InGrid);
  const canMove = !!move && !!taskId;
  const keyboard =
    Platform.OS === 'web' && canMove
      ? {
          tabIndex: 0,
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            move(taskId, event.key === 'ArrowUp' ? -1 : 1);
          },
        }
      : {};
  const handle = (
    <View
      accessibilityLabel={inGrid ? `Arrastar ${label}` : `Mover ${label}`}
      accessibilityHint={
        Platform.OS === 'web'
          ? 'Segure e arraste, ou use as setas para cima e para baixo'
          : 'Segure e arraste para mudar a ordem'
      }
      accessibilityRole={Platform.OS === 'web' ? 'button' : 'adjustable'}
      accessibilityActions={
        canMove
          ? [
              { name: 'decrement', label: 'Mover para cima' },
              { name: 'increment', label: 'Mover para baixo' },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (!canMove) return;
        if (event.nativeEvent.actionName === 'decrement') move(taskId, -1);
        if (event.nativeEvent.actionName === 'increment') move(taskId, 1);
      }}
      className="h-11 w-8 items-center justify-center rounded-md"
      {...(keyboard as object)}
    >
      <Text className="text-lg text-muted-foreground">⠿</Text>
    </View>
  );
  return inGrid ? <Sortable.Handle>{handle}</Sortable.Handle> : handle;
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

  function moveTo(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= tasks.length) return;
    const position = positionAfterMove(
      tasks.map((t) => t.position),
      fromIndex,
      toIndex,
    );
    update.mutate({ id: tasks[fromIndex].id, patch: { position } });
  }

  function moveBy(taskId: string, delta: -1 | 1) {
    if (!writable) return;
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index >= 0) moveTo(index, index + delta);
  }

  // Lista longa: sem a grade de arrastar, que refaz o layout de todos os itens a cada mudança
  // (500 itens: ~1,3 s para marcar um). Reordenar pelo teclado e pelo leitor de tela continua.
  if (tasks.length > SORTABLE_LIMIT) {
    return (
      <MoveContext.Provider value={moveBy}>
        <View style={{ flexDirection: columns > 1 ? 'row' : 'column', flexWrap: 'wrap', gap }}>
          {tasks.map((task) => (
            <View
              key={task.id}
              style={columns > 1 ? { width: `${100 / columns - 2}%`, flexGrow: 1 } : undefined}
            >
              {renderTask(task)}
            </View>
          ))}
        </View>
      </MoveContext.Provider>
    );
  }

  return (
    <MoveContext.Provider value={moveBy}>
      <InGrid.Provider value>
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
          onDragEnd={({ fromIndex, toIndex }) => moveTo(fromIndex, toIndex)}
          // A lib pode renderizar uma vez com a lista antiga quando os dados trocam (ex.: cache → servidor)
          renderItem={({ item }) => (item ? <>{renderTask(item)}</> : null)}
        />
      </InGrid.Provider>
    </MoveContext.Provider>
  );
}
