import { router } from 'expo-router';
import { GripVertical } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useCarryExercises, type CarryMode } from '@/components/gym/carry-exercises';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { usePageTasks, type Task } from '@/lib/queries/tasks';
import { isWorkoutPage, pageLabel, useTree, type Page } from '@/lib/queries/tree';

type Rect = { x: number; y: number; width: number; height: number };
type Drag = { task: Task; from: string };

/**
 * Organizar treinos (AC12.3, D276): todos os treinos lado a lado (empilhados no celular), para
 * arrastar um exercício de um para outro pela alça. Soltar em outro treino move ou copia, conforme
 * a escolha no alto; soltar fora não faz nada. No celular o arraste começa com toque longo, para a
 * rolagem continuar funcionando. Sem arrastar, o "…" do treino tem "Levar exercícios para outro
 * treino".
 */
export default function OrganizeWorkoutsScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const carry = useCarryExercises();
  const [mode, setMode] = useState<CarryMode>('move');
  const [drag, setDrag] = useState<Drag | null>(null);
  // O fim do gesto pode chegar com o estado de antes do re-render: a ref tem o arraste certo
  const dragRef = useRef<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const columns = useRef(new Map<string, View | null>());
  const rects = useRef(new Map<string, Rect>());
  const root = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pages = (tree.data?.pages ?? []).filter((p) => isWorkoutPage(tree.data, p));

  const ghost = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() + 8 }, { translateY: y.get() + 8 }],
  }));

  function measure() {
    root.current?.measureInWindow((rx, ry) => (origin.current = { x: rx, y: ry }));
    for (const [id, view] of columns.current)
      view?.measureInWindow((cx, cy, width, height) =>
        rects.current.set(id, { x: cx, y: cy, width, height }),
      );
  }

  function hit(px: number, py: number) {
    for (const [id, r] of rects.current)
      if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) return id;
    return null;
  }

  const handlers = {
    start: (task: Task, from: string, px: number, py: number) => {
      measure();
      dragRef.current = { task, from };
      setDrag({ task, from });
      x.set(px - origin.current.x);
      y.set(py - origin.current.y);
    },
    move: (px: number, py: number) => {
      x.set(px - origin.current.x);
      y.set(py - origin.current.y);
      const id = hit(px, py);
      setOver((current) => (current === id ? current : id));
    },
    end: (px: number, py: number) => {
      const target = hit(px, py);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setOver(null);
      if (!current || !target || target === current.from) return;
      const page = pages.find((p) => p.id === target);
      if (page) carry([current.task], page, mode);
    },
    cancel: () => {
      dragRef.current = null;
      setDrag(null);
      setOver(null);
    },
  };

  if (tree.data && pages.length < 2)
    return (
      <Screen size="medium">
        <ScreenHeader title={t('organize.title')} back />
        <EmptyState title={t('organize.empty')} hint={t('carry.noTargets')} />
      </Screen>
    );

  return (
    <Screen size="wide">
      <ScreenHeader title={t('organize.title')} back />
      <View ref={root} className="flex-1">
        <ScreenScroll contentContainerClassName="gap-4 pb-clear" scrollEnabled={!drag}>
          <Text className="text-sm text-ink-muted">
            {t(Platform.OS === 'web' ? 'organize.hintWeb' : 'organize.hint')}
          </Text>
          <View
            className="flex-row flex-wrap items-center gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('organize.mode')}
          >
            <Text className="text-sm text-ink">{t('organize.mode')}</Text>
            {(['move', 'copy'] as const).map((m) => (
              <Chip
                key={m}
                role="radio"
                label={t(m === 'move' ? 'carry.move' : 'carry.copy')}
                selected={mode === m}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
          <Grid breakpoints={[700, 1100, 1500]}>
            {pages.map((page) => (
              <View
                key={page.id}
                ref={(view) => {
                  columns.current.set(page.id, view);
                }}
                collapsable={false}
              >
                <Column
                  page={page}
                  over={over === page.id && drag?.from !== page.id}
                  dragging={drag?.task.id}
                  handlers={handlers}
                />
              </View>
            ))}
          </Grid>
        </ScreenScroll>
        {drag && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: 0, top: 0 }, ghost]}
          >
            <View className="rounded border border-accent bg-surface px-3 py-2">
              <Text className="text-sm text-ink">{drag.task.title}</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

type Handlers = {
  start: (task: Task, from: string, px: number, py: number) => void;
  move: (px: number, py: number) => void;
  end: (px: number, py: number) => void;
  cancel: () => void;
};

function Column({
  page,
  over,
  dragging,
  handlers,
}: {
  page: Page;
  over: boolean;
  dragging?: string;
  handlers: Handlers;
}) {
  const { t } = useTranslation();
  const tasks = usePageTasks(page.id);
  const items = (tasks.data ?? [])
    .filter((task) => !task.parent_task_id)
    .sort((a, b) => a.position - b.position);
  return (
    <View
      aria-label={pageLabel(page)}
      className={cn(
        'min-h-24 gap-1 rounded-lg border-2 p-3',
        over ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
      )}
    >
      <Text accessibilityRole="header" className="font-serif text-lg text-ink">
        {pageLabel(page)}
      </Text>
      {items.length === 0 && (
        <Text className="text-sm text-ink-muted">{t('organize.dropHere')}</Text>
      )}
      {items.map((task) => (
        <Row
          key={task.id}
          task={task}
          pageId={page.id}
          faded={dragging === task.id}
          handlers={handlers}
        />
      ))}
    </View>
  );
}

function Row({
  task,
  pageId,
  faded,
  handlers,
}: {
  task: Task;
  pageId: string;
  faded: boolean;
  handlers: Handlers;
}) {
  const { t } = useTranslation();
  const pan = Gesture.Pan()
    .runOnJS(true)
    // No celular, toque longo: senão a rolagem da tela vira arraste
    .activateAfterLongPress(Platform.OS === 'web' ? 0 : 250)
    .minDistance(Platform.OS === 'web' ? 4 : 0)
    .onStart((e) => handlers.start(task, pageId, e.absoluteX, e.absoluteY))
    .onUpdate((e) => handlers.move(e.absoluteX, e.absoluteY))
    .onEnd((e) => handlers.end(e.absoluteX, e.absoluteY))
    .onFinalize((_e, success) => {
      if (!success) handlers.cancel();
    });
  return (
    <View
      className={cn(
        'min-h-11 flex-row items-center gap-2 border-b border-line',
        faded && 'opacity-40',
      )}
    >
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={t('organize.drag', { name: task.title })}
          className="h-11 w-8 items-center justify-center"
          style={Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : undefined}
        >
          <Icon icon={GripVertical} tone="ink-muted" />
        </View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('task.details', { title: task.title })}
        className="flex-1 py-2"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      >
        <Text className="text-sm text-ink" numberOfLines={1}>
          {task.title}
        </Text>
      </Pressable>
    </View>
  );
}
