import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import type { TaskMeta } from '@/lib/parser/quick';
import { readRepeatPlan } from '@/lib/repeat';
import { useCreateTasks, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { isWorkoutPage, pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';

/**
 * Levar exercícios para outro treino (AC12.3): marcar um, vários ou todos, escolher o treino e
 * copiar (o exercício continua aqui) ou mover. A cópia leva o exercício da biblioteca, as séries, a
 * carga e a regra de progressão; o diário continua do exercício, então a progressão segue de onde
 * estava. Superset fica para trás: a letra só vale dentro da lista dele.
 */
export function CarryExercisesDialog({
  page,
  tasks,
  onClose,
}: {
  page: Page;
  tasks: Task[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const tree = useTree();
  const toast = useToast();
  const createTasks = useCreateTasks();
  const updateTask = useUpdateTask();
  const items = tasks
    .filter((task) => !task.parent_task_id)
    .sort((a, b) => a.position - b.position);
  const [picked, setPicked] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = (tree.data?.pages ?? []).filter(
    (p) => p.id !== page.id && isWorkoutPage(tree.data, p),
  );
  const target = targets.find((p) => p.id === targetId);
  const all = picked.length === items.length && items.length > 0;
  const chosen = items.filter((task) => picked.includes(task.id));

  const toggle = (id: string, on: boolean) =>
    setPicked((list) => (on ? [...list, id] : list.filter((x) => x !== id)));

  async function carry(mode: 'copy' | 'move') {
    if (!target || !chosen.length) return;
    setBusy(true);
    try {
      if (mode === 'copy') {
        await createTasks.mutateAsync({
          pageId: target.id,
          items: chosen.map((task) => ({
            id: uuidv7(),
            title: task.title,
            meta: (task.meta ?? null) as TaskMeta | null,
            repeatPlan: readRepeatPlan(task.repeat_plan),
            priority: task.priority as 0 | 1 | 2 | 3,
            dueDate: null,
            labels: task.labels ?? [],
            mentions: [],
            prereqs: [],
            recurrence: null,
            exerciseId: task.exercise_id,
            progression: task.progression,
          })),
        });
      } else {
        // No fim do treino de destino, na ordem em que estavam aqui
        const base = endPosition();
        await Promise.all(
          chosen.map((task, i) =>
            updateTask.mutateAsync({
              id: task.id,
              patch: { page_id: target.id, position: base + i, superset: null },
            }),
          ),
        );
      }
      toast({
        message: t(mode === 'copy' ? 'carry.copied' : 'carry.moved', {
          count: chosen.length,
          page: pageLabel(target),
        }),
      });
      onClose();
    } catch (err) {
      toast({ message: t('carry.error', { message: (err as Error).message }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {t('carry.title')}
      </Text>
      {targets.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('carry.noTargets')}</Text>
      ) : (
        <>
          <View className="flex-row items-center gap-2">
            <Checkbox
              checked={all}
              label={t('carry.all')}
              onChange={(on) => setPicked(on ? items.map((task) => task.id) : [])}
            />
            <Text className="text-sm font-semibold text-ink">{t('carry.all')}</Text>
            <Text className="ml-auto font-mono text-xs text-ink-muted">
              {t('carry.count', { count: picked.length })}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 280 }} className="border-y border-line">
            {items.map((task) => (
              <View key={task.id} className="flex-row items-center gap-2 border-b border-line">
                <Checkbox
                  checked={picked.includes(task.id)}
                  label={task.title}
                  onChange={(on) => toggle(task.id, on)}
                />
                <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                  {task.title}
                </Text>
                <Text className="pr-2 font-mono text-xs text-ink-muted">{dose(task)}</Text>
              </View>
            ))}
          </ScrollView>
          <Text className="text-sm font-semibold text-ink">{t('carry.to')}</Text>
          <View
            className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('carry.to')}
          >
            {targets.map((p) => (
              <Chip
                key={p.id}
                role="radio"
                label={pageLabel(p)}
                selected={p.id === targetId}
                onPress={() => setTargetId(p.id)}
              />
            ))}
          </View>
        </>
      )}
      <View className="flex-row flex-wrap justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        {targets.length > 0 && (
          <>
            <Button
              variant="ghost"
              label={t('carry.move')}
              disabled={!target || !chosen.length || busy}
              onPress={() => carry('move')}
            />
            <Button
              label={t('carry.copy')}
              loading={busy}
              disabled={!target || !chosen.length || busy}
              onPress={() => carry('copy')}
            />
          </>
        )}
      </View>
    </DialogFrame>
  );
}

/** Posição depois de tudo o que já está no destino (o painel da tarefa move do mesmo jeito). */
const endPosition = () => Date.now();

/** "3×10 · 40kg" do item, como nos cards. */
function dose(task: Task) {
  const meta = (task.meta ?? {}) as TaskMeta;
  const plan = readRepeatPlan(task.repeat_plan);
  const sets = plan?.total ?? meta.sets;
  const parts = [
    sets && plan?.mode === 'timed' && plan.duration_seconds
      ? `${sets}×${plan.duration_seconds}s`
      : sets && meta.reps
        ? `${sets}×${meta.reps}`
        : sets
          ? `${sets}×`
          : null,
    meta.weight ?? null,
  ];
  return parts.filter(Boolean).join(' · ');
}
