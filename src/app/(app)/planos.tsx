import { router } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ItemIcon } from '@/components/item-icon';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Grid } from '@/components/ui/grid';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { GYM_PLANS, planDaysPerWeek, type GymPlan, type PlanItem } from '@/lib/gym/plans';
import { exerciseName, useExerciseCatalog } from '@/lib/queries/exercises';
import { useCreatePlan } from '@/lib/queries/gym-plans';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type Place = 'all' | GymPlan['place'];

/**
 * Planos prontos (AC12.1, V6 §10): escolher um e a Academia ganha uma pasta com os treinos, os dias
 * da semana, a progressão e os exercícios da biblioteca. Depois é só ajustar a carga.
 */
export default function PlansScreen() {
  const { t } = useTranslation();
  const [place, setPlace] = useState<Place>('all');
  const plans = GYM_PLANS.filter((p) => place === 'all' || p.place === place);
  return (
    <Screen size="wide">
      <ScreenHeader title={t('plans.title')} back />
      <ScreenScroll contentContainerClassName="gap-4 pb-12">
        <Text className={cn('text-sm text-ink-muted', READABLE)}>{t('plans.intro')}</Text>
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('plans.place')}
        >
          {(['all', 'gym', 'home'] as const).map((p) => (
            <Chip
              key={p}
              role="radio"
              label={t(`plans.places.${p}`)}
              selected={place === p}
              onPress={() => setPlace(p)}
            />
          ))}
        </View>
        {/* Duas colunas no computador (D214); aberto, o cartão cresce só na própria coluna */}
        <Grid breakpoints={[1000]}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </Grid>
      </ScreenScroll>
    </Screen>
  );
}

function PlanCard({ plan }: { plan: GymPlan }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const catalog = useExerciseCatalog();
  const { create, pending } = useCreatePlan();
  const online = useIsOnline();
  const toast = useToast();
  const name = t(`plans.items.${plan.id}.name` as 'plans.items.abc.name');

  const exercise = (id: string) => {
    const e = catalog.data?.find((x) => x.id === id);
    return e ? exerciseName(e, i18n.language) : id;
  };
  const workoutName = (key: string) =>
    t(`plans.items.${plan.id}.w.${key}` as 'plans.items.abc.w.a');
  const days = (list: readonly number[]) =>
    list
      .map((d) =>
        // 25/10/2026 é domingo: + d dias dá o nome do dia no idioma
        new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(Date.UTC(2026, 9, 25 + d, 12)),
        ),
      )
      .join(', ');
  const dose = (item: PlanItem) =>
    item.sec
      ? t('plans.doseTime', { sets: item.sets, sec: item.sec })
      : t('plans.dose', { sets: item.sets, reps: item.reps });

  async function use() {
    try {
      const { folderId } = await create(plan, {
        folder: name,
        workout: workoutName,
        exercise,
      });
      toast({ message: t('plans.created', { name }) });
      router.replace({ pathname: '/folder/[id]', params: { id: folderId } });
    } catch (err) {
      toast({ message: t('plans.error', { message: (err as Error).message }) });
    }
  }

  return (
    <View aria-label={name} className="gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <ItemIcon icon={plan.icon} kind="folder" size={20} />
        <Text accessibilityRole="header" className="flex-1 font-serif text-lg text-ink">
          {name}
        </Text>
      </View>
      <Text className="text-sm text-ink-muted">
        {t(`plans.items.${plan.id}.desc` as 'plans.items.abc.desc')}
      </Text>
      <Text className="font-mono text-xs text-ink-muted">
        {[
          t('plans.perWeek', { count: planDaysPerWeek(plan) }),
          t(`plans.levels.${plan.level}`),
          t(`plans.places.${plan.place}`),
          t(`progression.rule_${plan.progression}`),
        ].join(' · ')}
      </Text>
      {open &&
        plan.workouts.map((w) => (
          <View key={w.key} className="gap-1 border-t border-line pt-3">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text className="text-sm font-semibold text-ink">{workoutName(w.key)}</Text>
              <Text className="font-mono text-xs text-ink-muted">{days(w.days)}</Text>
            </View>
            {w.items.map((item, i) => (
              <View key={`${item.exercise}-${i}`} className="flex-row justify-between gap-2">
                <Text className="flex-1 text-sm text-ink">{exercise(item.exercise)}</Text>
                <Text className="font-mono text-xs text-ink-muted">{dose(item)}</Text>
              </View>
            ))}
          </View>
        ))}
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          icon={open ? ChevronUp : ChevronDown}
          label={t(open ? 'plans.hide' : 'plans.show')}
          aria-expanded={open}
          onPress={() => setOpen(!open)}
        />
        <Button
          label={t('plans.use')}
          accessibilityLabel={t('plans.useLabel', { name })}
          loading={pending}
          disabled={!online || pending || !catalog.data}
          onPress={use}
        />
      </View>
    </View>
  );
}
