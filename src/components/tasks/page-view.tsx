import { router } from 'expo-router';
import { ChevronDown, ChevronRight, ListPlus, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { resetCycleLabel } from '@/components/page-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { setBatchDraft } from '@/lib/batch-draft';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, type Task } from '@/lib/queries/tasks';
import { useSelectableList } from '@/lib/selection';
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
  const { t } = useTranslation();
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

  // Ordem do teclado: as abertas, depois as concluídas
  const selectable = useMemo(() => [...open, ...done], [open, done]);
  useSelectableList(viewType === 'list' ? selectable : all);

  const empty = {
    list: { title: t('page.emptyList') },
    cards: { title: t('page.emptyCards'), hint: t('page.emptyCardsHint') },
    habits: { title: t('page.emptyHabits') },
    kanban: { title: t('page.emptyKanban') },
  }[viewType] ?? { title: t('page.emptyList') };

  return (
    <View className="flex-1 gap-4">
      {page && (viewType === 'list' || viewType === 'cards') && all.length > 0 && (
        <PageProgress page={page} done={all.length - open.length} total={all.length} />
      )}
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <QuickAdd
            pageId={page?.id}
            parseMeta={viewType === 'cards'}
            placeholder={viewType === 'habits' ? t('page.habitPlaceholder') : undefined}
            autoFocus={viewType === 'list'}
          />
        </View>
        <Button
          variant="ghost"
          icon={ListPlus}
          label={t('page.addManyShort')}
          accessibilityLabel={t('page.addMany')}
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
        <Text className="text-sm text-danger">
          {t('common.loadError', { message: tasks.error.message })}
        </Text>
      )}

      <Animated.ScrollView ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled">
        {viewType === 'kanban' && page ? (
          <KanbanBoard tasks={all} folderId={page.folder_id} subtaskCount={subtaskCount} />
        ) : viewType === 'cards' && page ? (
          <CardsBody tasks={all} subtaskCount={subtaskCount} scrollRef={scrollRef} />
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
          <EmptyState title={empty.title} hint={empty.hint} />
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
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        aria-expanded={show}
        accessibilityLabel={`${t('page.done')} ${tasks.length}`}
        className="mt-4 min-h-11 flex-row items-center gap-2 border-b border-line md:min-h-8"
        onPress={() => setShow(!show)}
      >
        <Icon icon={show ? ChevronDown : ChevronRight} tone="ink-muted" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('page.done')}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">{tasks.length}</Text>
      </Pressable>
      {show &&
        tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} subtasks={subtaskCount.get(t.id)} />
        ))}
    </View>
  );
}

/** Cards: grade (2 colunas a partir de 700 px, 3 a partir de 1200). */
function CardsBody({
  tasks,
  subtaskCount,
  scrollRef,
}: {
  tasks: Task[];
  subtaskCount: Counts;
  scrollRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
}) {
  const { width } = useWindowDimensions();
  if (tasks.length === 0) return null;
  return (
    <SortableTasks
      tasks={tasks}
      columns={width >= 1200 ? 3 : width >= 700 ? 2 : 1}
      gap={12}
      scrollRef={scrollRef}
      renderTask={(t) => <TaskCard task={t} subtasks={subtaskCount.get(t.id)} />}
    />
  );
}

/**
 * Progresso da página (docs/mockups): "7 de 12 feitos" e o reinício em mono, com a régua de 2 px.
 * No reinício manual, o botão de reiniciar fica ao lado.
 */
function PageProgress({ page, done, total }: { page: Page; done: number; total: number }) {
  const { t } = useTranslation();
  const { resetPage } = useTreeMutations();
  const writable = useCanWrite(page.folder_id);
  const toast = useToast();
  const complete = total > 0 && done === total;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-mono text-xs text-ink" accessibilityLiveRegion="polite">
          {complete ? t('page.allDone') : t('page.progress', { done, total })}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="font-mono text-xs text-ink-muted">
            {resetCycleLabel(page.reset_cycle, t)}
          </Text>
          {page.reset_cycle === 'manual' && (
            <Button
              variant="ghost"
              icon={RotateCcw}
              label={t('page.reset')}
              disabled={!writable || done === 0}
              onPress={() =>
                resetPage.mutate(page.id, {
                  onSuccess: () => toast({ message: t('page.resetDone') }),
                })
              }
            />
          )}
        </View>
      </View>
      <ProgressBar value={done / total} label={t('page.progress', { done, total })} />
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
