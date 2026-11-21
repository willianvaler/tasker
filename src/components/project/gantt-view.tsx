import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { openTask } from '@/components/project/flow-parts';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { ActionMenu, ConfirmDialog, PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  diffDays,
  dragDates,
  ganttArrows,
  ganttPlan,
  type DragMode,
  type GanttRow,
} from '@/lib/gantt';
import { addDays, formatMonthYear, formatShortDate, weekdayOf } from '@/lib/parser/dates';
import { actorCan } from '@/lib/permissions';
import { compareBaseline, delayLabel } from '@/lib/baseline';
import { useBaselineActions, useBaselines } from '@/lib/queries/baselines';
import { useMilestoneMutations, useMilestones, type Milestone } from '@/lib/queries/milestones';
import { useProjectDependencies } from '@/lib/queries/dependencies';
import { useProjectAllTasks } from '@/lib/queries/flow';
import { useToday } from '@/lib/queries/profile';
import { useFolderActor } from '@/lib/queries/projects';
import { useUpdateTask } from '@/lib/queries/tasks';
import type { FolderNode } from '@/lib/queries/tree';
import { useColors } from '@/lib/tokens';
import { useCanWrite } from '@/providers/write';
import { useToast } from '@/providers/toast';

// Gantt editável (PC3, V3 §6 C, D308): uma linha por tarefa com vencimento, a barra do início ao
// vencimento, as setas das dependências e a linha de hoje. Arrastar a barra muda as duas datas;
// as bordas, uma só. Tocar abre um menu com os mesmos ajustes (teclado, leitor de tela, celular).

const ROW = 36;
const HEAD = 40;
const HANDLE = 10;
const ZOOM = { day: 32, week: 12 } as const;

type Drag = { id: string; mode: DragMode; delta: number };

/** `only`: só estas tarefas (a visão Gantt de uma lista, VS1); sem ele, o projeto inteiro. */
export function GanttView({ root, only }: { root: FolderNode; only?: readonly string[] }) {
  const { t } = useTranslation();
  const today = useToday();
  const colors = useColors();
  const toast = useToast();
  const tasks = useProjectAllTasks(root);
  const deps = useProjectDependencies(root.id);
  const update = useUpdateTask();
  const actor = useFolderActor(root.id);
  const writable = useCanWrite(root.id, { offline: true }) && actorCan(actor, 'task.edit');
  const [zoom, setZoom] = useState<keyof typeof ZOOM>('day');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [menu, setMenu, closeMenu] = useDialog<GanttRow>();
  // O clique que termina um arrasto não abre o menu
  const droppedAt = useRef(0);
  // Linha de base (GP2): salvar quem mexe na estrutura; comparar, qualquer um do projeto
  const baselines = useBaselines(root.id);
  const baselineActions = useBaselineActions(root.id);
  const canBaseline = useCanWrite(root.id) && actorCan(actor, 'page.manage');
  const [compareId, setCompareId] = useState<string | null>(null);
  // Marcos (GP3): losango na data; o menu muda a data dia a dia
  const milestones = useMilestones(root.id);
  const milestoneActions = useMilestoneMutations(root.id);
  const [milestoneMenu, setMilestoneMenu, closeMilestoneMenu] = useDialog<Milestone>();
  const [naming, setNaming] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (tasks.isPending || deps.isPending) return null;
  const pageOrder = [...root.pages, ...root.children.flatMap((c) => c.pages)].map((p) => p.id);
  const links = (deps.data?.deps ?? []).map((d) => ({
    task_id: d.task_id,
    depends_on_task_id: d.depends_on_task_id,
  }));
  const dayW = ZOOM[zoom];
  const onlySet = only ? new Set(only) : null;
  const shownTasks = onlySet
    ? (tasks.data ?? []).filter((task) => onlySet.has(task.id))
    : (tasks.data ?? []);
  const plan = ganttPlan(shownTasks, links, {
    today,
    pageOrder,
    minDays: Math.ceil(chartWidth / dayW),
  });

  function apply(row: GanttRow, mode: DragMode, delta: number) {
    const dates = dragDates(row.task, mode, delta);
    if (!dates) return;
    update.mutate(
      { id: row.task.id, patch: dates },
      { onError: (err: Error) => toast({ message: err.message }) },
    );
  }

  if (!plan.rows.length && !plan.undated.length)
    return <EmptyState title={t('gantt.empty')} hint={t('gantt.emptyHint')} />;

  // Posição de cada barra, já com o arrasto em curso
  const span = (row: GanttRow) => {
    const live = drag?.id === row.task.id ? dragDates(row.task, drag.mode, drag.delta) : null;
    const start = live ? (live.start_date ?? live.due_date) : row.start;
    const end = live ? live.due_date : row.end;
    return {
      start,
      end,
      left: diffDays(plan.from, start) * dayW,
      width: (diffDays(start, end) + 1) * dayW,
    };
  };
  const width = plan.days * dayW;
  const height = HEAD + plan.rows.length * ROW;
  const todayX = diffDays(plan.from, today) * dayW + dayW / 2;
  const arrows = ganttArrows(plan.rows, links);
  const days = Array.from({ length: plan.days }, (_, i) => addDays(plan.from, i));
  const compared = baselines.data?.find((b) => b.id === compareId) ?? null;
  // Numa lista, a foto conta só as tarefas dela (as das outras listas não "saíram")
  const diff = compared
    ? compareBaseline(
        shownTasks,
        onlySet ? compared.items.filter((i) => onlySet.has(i.t)) : compared.items,
      )
    : null;

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup">
        {(['day', 'week'] as const).map((z) => (
          <Chip
            key={z}
            role="radio"
            label={t(z === 'day' ? 'gantt.zoomDay' : 'gantt.zoomWeek')}
            selected={zoom === z}
            onPress={() => setZoom(z)}
          />
        ))}
        <Text className="text-sm text-ink-muted">
          {writable ? t('gantt.hint') : t('gantt.readOnly')}
        </Text>
      </View>

      {(canBaseline || (baselines.data?.length ?? 0) > 0) && (
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-semibold text-ink">{t('baseline.title')}</Text>
            {baselines.data?.map((b) => (
              <Chip
                key={b.id}
                role="checkbox"
                label={`${b.name} · ${formatShortDate(b.created_at.slice(0, 10))}`}
                selected={compareId === b.id}
                onPress={() => setCompareId(compareId === b.id ? null : b.id)}
              />
            ))}
            {canBaseline && (
              <Button
                variant="ghost"
                label={t('baseline.save')}
                disabled={(baselines.data?.length ?? 0) >= 5}
                loading={baselineActions.save.isPending}
                onPress={() => setNaming(true)}
              />
            )}
            {canBaseline && compared && (
              <Button
                variant="ghost"
                destructive
                label={t('baseline.delete')}
                onPress={() => setRemoving(true)}
              />
            )}
          </View>
          {diff ? (
            <Text className="text-sm text-ink" accessibilityLiveRegion="polite">
              {[
                diff.late
                  ? t('baseline.late', { count: diff.late, days: diff.totalDelay })
                  : t('baseline.onPlan'),
                diff.added.length ? t('baseline.added', { count: diff.added.length }) : null,
                diff.removed.length ? t('baseline.removed', { count: diff.removed.length }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : (
            <Text className="text-sm text-ink-muted">
              {(baselines.data?.length ?? 0) >= 5 ? t('baseline.full') : t('baseline.hint')}
            </Text>
          )}
        </View>
      )}

      {plan.rows.length > 0 && (
        <View className="flex-row rounded border border-line">
          {/* Títulos, fixos à esquerda */}
          <View className="w-36 border-r border-line md:w-56">
            <View style={{ height: HEAD }} className="justify-end border-b border-line px-2 pb-1">
              <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('gantt.task')}
              </Text>
            </View>
            {plan.rows.map((row) => (
              <Pressable
                key={row.task.id}
                accessibilityRole="link"
                onPress={() => openTask(row.task.id)}
                style={{ height: ROW, paddingLeft: 8 + row.depth * 12 }}
                className="justify-center border-b border-line pr-2 hover:bg-wash"
              >
                <Text
                  numberOfLines={1}
                  className={cn(
                    'text-sm',
                    row.task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                  )}
                >
                  {row.task.title}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            horizontal
            className="flex-1"
            scrollEnabled={!drag}
            onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
          >
            <View style={{ width, height }}>
              {/* Dias: fim de semana mais escuro; o número do dia (e o mês no dia 1 ou no começo) */}
              {days.map((day, i) => {
                const weekend = weekdayOf(day) === 0 || weekdayOf(day) === 6;
                const label = zoom === 'day' || weekdayOf(day) === 1 ? day.slice(8) : '';
                return (
                  <View
                    key={day}
                    style={{ position: 'absolute', left: i * dayW, width: dayW, top: 0, bottom: 0 }}
                    className={cn('border-l border-line/60', weekend && 'bg-wash/60')}
                  >
                    <Text
                      style={{ position: 'absolute', top: HEAD - 18, width: dayW }}
                      className="text-center font-mono text-xs text-ink-muted"
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
              {/* Mês: no primeiro dia da tela e em cada dia 1 (fora da coluna, para caber o nome) */}
              {days.map((day, i) =>
                i === 0 || day.endsWith('-01') ? (
                  <Text
                    key={`m${day}`}
                    numberOfLines={1}
                    style={{ position: 'absolute', left: i * dayW + 4, top: 4, width: 160 }}
                    className="text-xs text-ink-muted"
                  >
                    {formatMonthYear(day.slice(0, 7))}
                  </Text>
                ) : null,
              )}
              <View
                style={{ position: 'absolute', top: HEAD - 1, left: 0, right: 0 }}
                className="border-b border-line"
              />
              {/* Marcos (GP3): losango no cabeçalho, na data do marco */}
              {(milestones.data ?? []).map((ms) => {
                if (!ms.due_date) return null;
                const x = diffDays(plan.from, ms.due_date) * dayW + dayW / 2;
                if (x < 0 || x > width) return null;
                return (
                  <Pressable
                    key={`ms-${ms.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('gantt.milestone', {
                      name: ms.name,
                      date: formatShortDate(ms.due_date),
                    })}
                    onPress={() => setMilestoneMenu(ms)}
                    style={{
                      position: 'absolute',
                      left: x - 8,
                      top: HEAD - 18,
                      width: 16,
                      height: 16,
                    }}
                    className="items-center justify-center"
                  >
                    <View
                      style={{ width: 10, height: 10, transform: [{ rotate: '45deg' }] }}
                      className={ms.done_at ? 'bg-ink-muted' : 'bg-accent'}
                    />
                  </Pressable>
                );
              })}
              {/* Hoje */}
              {todayX >= 0 && todayX <= width && (
                <View
                  style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: 2 }}
                  className="bg-accent/70"
                  accessibilityLabel={t('gantt.today')}
                />
              )}
              {/* Setas das dependências */}
              <Svg
                width={width}
                height={height}
                style={{ position: 'absolute', left: 0, top: 0 }}
                pointerEvents="none"
              >
                {arrows.map((a) => {
                  const from = span(plan.rows[a.from]);
                  const to = span(plan.rows[a.to]);
                  const x1 = from.left + from.width;
                  const y1 = HEAD + a.from * ROW + ROW / 2;
                  const x2 = to.left;
                  const y2 = HEAD + a.to * ROW + ROW / 2;
                  const mid = Math.max(x1 + 6, Math.min(x2 - 6, (x1 + x2) / 2));
                  return (
                    <Path
                      key={a.id}
                      d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2 - 2} m -5 -4 l 5 4 l -5 4`}
                      stroke={plan.rows[a.to].early ? colors.warn : colors['ink-muted']}
                      strokeWidth={1.5}
                      fill="none"
                    />
                  );
                })}
              </Svg>
              {/* Linha de base (GP2): a barra do plano, fina e apagada, embaixo da atual */}
              {diff &&
                plan.rows.map((row, i) => {
                  const base = diff.byTask.get(row.task.id);
                  if (!base) return null;
                  const current = span(row);
                  return (
                    <View key={`base-${row.task.id}`} pointerEvents="none">
                      <View
                        style={{
                          position: 'absolute',
                          left: diffDays(plan.from, base.start) * dayW,
                          width: (diffDays(base.start, base.end) + 1) * dayW,
                          top: HEAD + i * ROW + ROW - 7,
                          height: 4,
                        }}
                        className="rounded bg-ink-muted/40"
                      />
                      {base.delay !== 0 && (
                        <Text
                          style={{
                            position: 'absolute',
                            left: current.left + current.width + 4,
                            top: HEAD + i * ROW + ROW / 2 - 9,
                          }}
                          className={cn(
                            'text-xs',
                            base.delay > 0 ? 'text-danger' : 'text-ink-muted',
                          )}
                          accessibilityLabel={t('baseline.delayLabel', {
                            title: row.task.title,
                            label: delayLabel(base.delay),
                          })}
                        >
                          {delayLabel(base.delay)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              {plan.rows.map((row, i) => (
                <Bar
                  key={row.task.id}
                  row={row}
                  top={HEAD + i * ROW}
                  dayW={dayW}
                  span={span(row)}
                  editable={writable}
                  onDrag={(mode, delta) => setDrag({ id: row.task.id, mode, delta })}
                  onDrop={(mode, delta) => {
                    setDrag(null);
                    if (delta) droppedAt.current = Date.now();
                    apply(row, mode, delta);
                  }}
                  onPress={() => {
                    if (Date.now() - droppedAt.current > 50) setMenu(row);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {plan.undated.length > 0 && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('gantt.undated', { count: plan.undated.length })}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {plan.undated.slice(0, 30).map((task) => (
              <Chip
                key={task.id}
                label={task.title}
                onPress={() =>
                  writable
                    ? update.mutate(
                        { id: task.id, patch: { due_date: today } },
                        { onError: (err: Error) => toast({ message: err.message }) },
                      )
                    : openTask(task.id)
                }
              />
            ))}
          </View>
          {writable && <Text className="text-sm text-ink-muted">{t('gantt.undatedHint')}</Text>}
        </View>
      )}

      {naming && (
        <PromptDialog
          title={t('baseline.save')}
          message={t('baseline.saveMessage')}
          fields={[
            {
              key: 'name',
              placeholder: t('baseline.namePlaceholder'),
              initial: t('baseline.defaultName'),
              maxLength: 80,
            },
          ]}
          onClose={() => setNaming(false)}
          onConfirm={({ name }) => {
            setNaming(false);
            baselineActions.save
              .mutateAsync(name)
              .then((id) => {
                setCompareId(id);
                toast({ message: t('baseline.saved') });
              })
              .catch((err: Error) => toast({ message: err.message }));
          }}
        />
      )}
      {removing && compared && (
        <ConfirmDialog
          title={t('baseline.deleteTitle', { name: compared.name })}
          message={t('baseline.deleteMessage')}
          confirmLabel={t('baseline.delete')}
          destructive
          onClose={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            setCompareId(null);
            baselineActions.remove.mutate(compared.id);
          }}
        />
      )}

      {milestoneMenu && milestoneMenu.due_date && (
        <ActionMenu
          title={milestoneMenu.name}
          onClose={closeMilestoneMenu}
          actions={[
            {
              label: t('roadmap.open'),
              onPress: () => router.push(`/roadmap/${root.id}`),
            },
            ...(canBaseline
              ? [
                  {
                    label: t('gantt.earlier'),
                    onPress: () =>
                      milestoneActions.update.mutate({
                        id: milestoneMenu.id,
                        due_date: addDays(milestoneMenu.due_date ?? today, -1),
                      }),
                  },
                  {
                    label: t('gantt.later'),
                    onPress: () =>
                      milestoneActions.update.mutate({
                        id: milestoneMenu.id,
                        due_date: addDays(milestoneMenu.due_date ?? today, 1),
                      }),
                  },
                ]
              : []),
          ]}
        />
      )}

      {menu && (
        <ActionMenu
          title={menu.task.title}
          onClose={closeMenu}
          actions={[
            { label: t('gantt.open'), onPress: () => openTask(menu.task.id) },
            ...(writable
              ? [
                  { label: t('gantt.earlier'), onPress: () => apply(menu, 'move', -1) },
                  { label: t('gantt.later'), onPress: () => apply(menu, 'move', 1) },
                  { label: t('gantt.longer'), onPress: () => apply(menu, 'end', 1) },
                  ...(menu.start < menu.end
                    ? [{ label: t('gantt.shorter'), onPress: () => apply(menu, 'end', -1) }]
                    : []),
                  { label: t('gantt.startEarlier'), onPress: () => apply(menu, 'start', -1) },
                ]
              : []),
          ]}
        />
      )}
    </View>
  );
}

function Bar({
  row,
  top,
  dayW,
  span,
  editable,
  onDrag,
  onDrop,
  onPress,
}: {
  row: GanttRow;
  top: number;
  dayW: number;
  span: { start: string; end: string; left: number; width: number };
  editable: boolean;
  onDrag: (mode: DragMode, delta: number) => void;
  onDrop: (mode: DragMode, delta: number) => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  // Mesmo jeito do quadro (kanban-board): no celular, toque longo antes de arrastar, senão a
  // rolagem da tela vira arrasto; no computador, a partir de 4 px
  const pan = (mode: DragMode) => {
    const gesture = Gesture.Pan()
      .runOnJS(true)
      .enabled(editable)
      .minDistance(Platform.OS === 'web' ? 4 : 0)
      .onUpdate((e) => onDrag(mode, Math.round(e.translationX / dayW)))
      .onEnd((e) => onDrop(mode, Math.round(e.translationX / dayW)))
      .onFinalize((_e, success) => {
        if (!success) onDrop(mode, 0);
      });
    // Só no celular: com o toque longo valendo também na web (0 ms), o Pan ganharia todo clique
    return Platform.OS === 'web' ? gesture : gesture.activateAfterLongPress(250);
  };
  const done = row.task.status === 'done';
  const label = t('gantt.barLabel', {
    title: row.task.title,
    start: formatShortDate(span.start),
    end: formatShortDate(span.end),
  });
  const handle = (mode: 'start' | 'end') =>
    editable ? (
      <GestureDetector gesture={pan(mode)}>
        <View
          accessibilityLabel={t(mode === 'start' ? 'gantt.dragStart' : 'gantt.dragEnd', {
            title: row.task.title,
          })}
          style={[
            { width: HANDLE },
            Platform.OS === 'web' ? ({ cursor: 'ew-resize' } as object) : null,
          ]}
          className="h-full bg-on-accent/20"
        />
      </GestureDetector>
    ) : null;
  return (
    <View
      style={{
        position: 'absolute',
        top: top + 6,
        left: span.left + 1,
        width: Math.max(span.width - 2, 8),
        height: ROW - 12,
      }}
      className={cn(
        'flex-row overflow-hidden rounded',
        done ? 'bg-ink-muted/40' : 'bg-accent',
        row.early && 'border-2 border-warn',
      )}
    >
      {span.width > 3 * HANDLE && handle('start')}
      <GestureDetector gesture={pan('move')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={row.early ? t('gantt.early') : undefined}
          onPress={onPress}
          style={
            Platform.OS === 'web'
              ? ({ cursor: editable ? 'grab' : 'pointer' } as object)
              : undefined
          }
          className="flex-1 justify-center"
        >
          {span.width > 60 && (
            <Text
              numberOfLines={1}
              className={cn('px-1 text-xs', done ? 'text-ink' : 'text-on-accent')}
            >
              {row.task.title}
            </Text>
          )}
        </Pressable>
      </GestureDetector>
      {span.width > 3 * HANDLE && handle('end')}
    </View>
  );
}
