import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { resetCycleLabel } from '@/components/page-dialog';
import { Button } from '@/components/ui/button';
import { setBatchDraft } from '@/lib/batch-draft';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, type Task } from '@/lib/queries/tasks';
import { useTreeMutations, type Page } from '@/lib/queries/tree';
import { useCanWrite } from '@/providers/write';
import { useToast } from '@/providers/toast';
import { HabitRow, useHabitDates } from './habit-row';
import { KanbanBoard } from './kanban-board';
import { QuickAdd } from './quick-add';
import { SortableTasks } from './sortable-tasks';
import { TaskCard } from './task-card';
import { TaskRow } from './task-row';

type Counts = Map<string, { done: number; total: number }>;

const byPosition = (a: Task, b: Task) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Conteúdo de uma página, conforme o tipo: lista, cards, hábitos ou kanban. */
export function PageView({ page }: { page: Page | undefined }) {
  const today = useToday();
  const tasks = usePageTasks(page?.id);
  const writable = useCanWrite(page?.folder_id);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const viewType = page?.view_type ?? 'list';

  const { open, done, all, subtaskCount } = useMemo(() => {
    const count: Counts = new Map();
    for (const t of tasks.data ?? []) {
      if (!t.parent_task_id) continue;
      const c = count.get(t.parent_task_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.status === 'done') c.done++;
      count.set(t.parent_task_id, c);
    }
    const top = (tasks.data ?? []).filter((t) => !t.parent_task_id).sort(byPosition);
    return {
      all: top,
      open: top.filter((t) => t.status !== 'done'),
      done: top
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
      subtaskCount: count,
    };
  }, [tasks.data]);

  const empty = {
    list: 'Nada por aqui. Digite uma tarefa acima, ou cole uma lista.',
    cards: 'Monte a rotina: cole os itens, um por linha. Dica: "Supino 4x12 20kg".',
    habits: 'Adicione hábitos, como "Beber água" ou "Ler 10 páginas /seg,qua,sex".',
    kanban: 'Quadro vazio. Digite uma tarefa acima: ela entra em "A fazer".',
  }[viewType];

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <QuickAdd
            pageId={page?.id}
            parseMeta={viewType === 'cards'}
            placeholder={viewType === 'habits' ? 'Novo hábito… (ex.: Meditar /diaria)' : undefined}
            autoFocus={viewType === 'list'}
          />
        </View>
        <Button
          variant="outline"
          label="Várias"
          accessibilityLabel="Adicionar várias"
          disabled={!page || !writable}
          onPress={() => {
            // Sem "page!.id": o React Compiler pode ler o valor já no render (com a página ainda carregando)
            if (!page) return;
            setBatchDraft(page.id, '');
            router.push('/batch');
          }}
        />
      </View>
      {tasks.error && (
        <Text className="mt-4 text-destructive">Erro ao carregar: {tasks.error.message}</Text>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        className="mt-2 flex-1"
        keyboardShouldPersistTaps="handled"
      >
        {viewType === 'kanban' && page ? (
          <KanbanBoard tasks={all} folderId={page.folder_id} subtaskCount={subtaskCount} />
        ) : viewType === 'cards' && page ? (
          <CardsBody page={page} tasks={all} subtaskCount={subtaskCount} scrollRef={scrollRef} />
        ) : viewType === 'habits' ? (
          <HabitsBody tasks={all} scrollRef={scrollRef} />
        ) : (
          <>
            <SortableTasks
              tasks={open}
              scrollRef={scrollRef}
              renderTask={(t) => (
                <TaskRow task={t} today={today} subtasks={subtaskCount.get(t.id)} draggable />
              )}
            />
            <DoneSection tasks={done} today={today} subtaskCount={subtaskCount} />
          </>
        )}
        {!tasks.isPending && all.length === 0 && (
          <Text className="mt-8 text-center text-muted-foreground">{empty}</Text>
        )}
        <View className="h-28" />
      </Animated.ScrollView>
    </View>
  );
}

function DoneSection({
  tasks,
  today,
  subtaskCount,
}: {
  tasks: Task[];
  today: string;
  subtaskCount: Counts;
}) {
  const [show, setShow] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        aria-expanded={show}
        className="min-h-11 justify-center"
        onPress={() => setShow(!show)}
      >
        <Text className="text-sm font-semibold text-muted-foreground">
          {show ? '▾' : '▸'} Concluídas ({tasks.length})
        </Text>
      </Pressable>
      {show &&
        tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} subtasks={subtaskCount.get(t.id)} />
        ))}
    </View>
  );
}

/** Cards: barra de progresso, reinício e grade de cards (2 colunas em tela larga). */
function CardsBody({
  page,
  tasks,
  subtaskCount,
  scrollRef,
}: {
  page: Page;
  tasks: Task[];
  subtaskCount: Counts;
  scrollRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
}) {
  const { width } = useWindowDimensions();
  const { resetPage } = useTreeMutations();
  const writable = useCanWrite(page.folder_id);
  const toast = useToast();
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length;
  const complete = total > 0 && doneCount === total;

  if (total === 0) return null;
  return (
    <View className="gap-3 pt-2">
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-foreground" accessibilityLiveRegion="polite">
            {complete ? 'Tudo feito! 🎉' : `${doneCount}/${total} feitos`}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              {resetCycleLabel(page.reset_cycle)}
            </Text>
            {page.reset_cycle === 'manual' && (
              <Button
                variant="ghost"
                label="Reiniciar"
                disabled={!writable || doneCount === 0}
                onPress={() =>
                  resetPage.mutate(page.id, {
                    onSuccess: () =>
                      toast({ message: 'Checks reiniciados. O histórico ficou guardado.' }),
                  })
                }
              />
            )}
          </View>
        </View>
        <View
          className="h-2 overflow-hidden rounded-full bg-muted"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: doneCount }}
        >
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </View>
      </View>
      <SortableTasks
        tasks={tasks}
        columns={width >= 700 ? 2 : 1}
        gap={12}
        scrollRef={scrollRef}
        renderTask={(t) => <TaskCard task={t} subtasks={subtaskCount.get(t.id)} />}
      />
    </View>
  );
}

function HabitsBody({
  tasks,
  scrollRef,
}: {
  tasks: Task[];
  scrollRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
}) {
  const { datesOf, today } = useHabitDates(tasks);
  return (
    <SortableTasks
      tasks={tasks}
      scrollRef={scrollRef}
      renderTask={(t) => <HabitRow task={t} dates={datesOf(t)} today={today} draggable />}
    />
  );
}
