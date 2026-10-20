import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ActionMenu } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { weekPlan } from '@/lib/gym/week-plan';
import { addDays, formatDueDate, formatShortDate } from '@/lib/parser/dates';
import { useProfile, useToday } from '@/lib/queries/profile';
import { isWorkoutPage, pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { useMoveWorkout, useWorkoutMoves } from '@/lib/queries/week-plan';
import { useToast } from '@/providers/toast';

/** Segunda a domingo (o banco guarda 0 = domingo) */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** Configurar o treino: os dias da semana em que ele é feito (AC9.5). */
export function TrainDaysEditor({
  value,
  onSave,
}: {
  value: readonly number[] | null;
  onSave: (days: number[]) => void;
}) {
  const { t } = useTranslation();
  // A escolha fica aqui: tocar vários dias seguidos não pode partir do valor de antes do salvar
  const [days, setDays] = useState(() => new Set(value ?? []));
  return (
    <View className="gap-2">
      <Text className="text-sm text-ink-muted">{t('weekPlan.daysHint')}</Text>
      <View className="flex-row flex-wrap gap-1">
        {WEEK.map((d) => (
          <Chip
            key={d}
            role="checkbox"
            label={t(`weekPlan.day_${d}`)}
            selected={days.has(d)}
            onPress={() => {
              const next = new Set(days);
              if (next.has(d)) next.delete(d);
              else next.add(d);
              setDays(next);
              onSave([...next].sort());
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * "Treino de hoje" (AC9.5): os treinos planejados para hoje (com as remarcações), com Abrir e
 * Remarcar (amanhã, depois de amanhã, pular), e a semana em uma linha. Some sem plano.
 */
export function TodayWorkout() {
  const { t } = useTranslation();
  const gymOn = useProfile().data?.gym_enabled === true;
  const tree = useTree();
  const moves = useWorkoutMoves();
  const move = useMoveWorkout();
  const today = useToday();
  const toast = useToast();
  const [moving, setMoving] = useState<Page | null>(null);

  const pages = (tree.data?.pages ?? []).filter(
    (p) => p.train_days?.length && isWorkoutPage(tree.data, p),
  );
  if (!gymOn || !pages.length) return null;
  const week = weekPlan(
    today,
    pages.map((p) => ({ id: p.id, name: pageLabel(p), train_days: p.train_days })),
    moves.data ?? [],
  );
  const todays = pages.filter((p) => week[0].pages.some((x) => x.id === p.id));

  const moveTo = (page: Page, to: string | null) =>
    move.mutate(
      { pageId: page.id, from: today, to },
      {
        onSuccess: () =>
          toast({
            message: to
              ? t('weekPlan.moved', { page: pageLabel(page), day: formatDueDate(to, today) })
              : t('weekPlan.skipped', { page: pageLabel(page) }),
            action: {
              label: t('weekPlan.undo'),
              onPress: () => move.mutate({ pageId: page.id, from: today, undo: true }),
            },
          }),
        onError: (e) => toast({ message: e.message }),
      },
    );

  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('weekPlan.today')}
      </Text>
      {todays.map((p) => (
        <View key={p.id} className="min-h-10 flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-base text-ink">{pageLabel(p)}</Text>
          <Button
            variant="ghost"
            label={t('weekPlan.open')}
            onPress={() => router.push({ pathname: '/page/[id]', params: { id: p.id } })}
          />
          <Button variant="ghost" label={t('weekPlan.move')} onPress={() => setMoving(p)} />
        </View>
      ))}
      <Text className="text-sm text-ink-muted">
        {`${t('weekPlan.week')}: `}
        {week
          .slice(todays.length ? 1 : 0)
          .map(
            (d) =>
              `${formatShortDate(d.day)} ${d.pages.map((p) => p.name).join(', ') || t('weekPlan.rest')}`,
          )
          .join(' · ')}
      </Text>
      {moving && (
        <ActionMenu
          title={t('weekPlan.moveTo', { page: pageLabel(moving) })}
          onClose={() => setMoving(null)}
          actions={[
            { label: t('weekPlan.tomorrow'), onPress: () => moveTo(moving, addDays(today, 1)) },
            { label: t('weekPlan.inTwo'), onPress: () => moveTo(moving, addDays(today, 2)) },
            { label: t('weekPlan.skip'), onPress: () => moveTo(moving, null) },
          ]}
        />
      )}
    </View>
  );
}
