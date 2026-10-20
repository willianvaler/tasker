import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { groupByDay } from '@/lib/gym/history';
import { best1Rm, estimate1Rm, MAX_REPS_FOR_1RM, percentTable } from '@/lib/gym/one-rm';
import { formatWeight, fromKg, toKg, weightStep } from '@/lib/gym/units';
import { formatShortDate, todayIn } from '@/lib/parser/dates';
import { useGymPrefs, useTimeZone } from '@/lib/queries/profile';
import { useWorkoutHistory, type WorkoutSet } from '@/lib/queries/workout-sets';
import { parseDecimal } from './set-row';

const CHART_DAYS = 12;

/**
 * Recordes e 1RM (AC5.4, V6 §4): os melhores do exercício, de que série veio o 1RM e a evolução
 * dele por dia (as últimas sessões). Some sem nenhuma série no diário.
 */
export function ExerciseRecords({
  exerciseId,
  taskId,
}: {
  exerciseId?: string | null;
  taskId?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const history = useWorkoutHistory({ exerciseId, taskId });
  const timeZone = useTimeZone();
  const { unit } = useGymPrefs();
  const lang = i18n.language;
  const sets = (history.data ?? []).filter((s) => !s.warmup);
  if (!sets.length) return null;

  const days = groupByDay(sets, timeZone);
  const kg = (v: number) => formatWeight(v, unit, lang);
  const maxOf = (pick: (s: WorkoutSet) => number | null) =>
    sets.reduce<number | null>((m, s) => {
      const v = pick(s);
      return v != null && (m == null || v > m) ? v : m;
    }, null);

  const best = best1Rm(sets);
  const heaviest = maxOf((s) => ((s.reps ?? 0) >= 1 ? s.weight_kg : null));
  const mostReps = maxOf((s) => s.reps);
  const bestVolume = days.reduce((m, d) => Math.max(m, d.volumeKg), 0);
  const longest = maxOf((s) => s.duration_seconds);
  const farthest = maxOf((s) => s.distance_m);
  const dayOf = (iso: string) => formatShortDate(todayIn(timeZone, new Date(iso)));

  const rows = [
    heaviest != null ? [t('records.weight'), kg(heaviest)] : null,
    mostReps != null ? [t('records.reps'), t('workout.reps', { count: mostReps })] : null,
    best ? [t('records.one_rm'), kg(best.oneRm)] : null,
    bestVolume > 0 ? [t('records.volume'), kg(bestVolume)] : null,
    longest != null ? [t('records.duration'), t('diary.seconds', { count: longest })] : null,
    farthest != null
      ? [
          t('records.distance'),
          t('diary.km', {
            value: new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(
              farthest / 1000,
            ),
          }),
        ]
      : null,
  ].filter((r): r is string[] => !!r);

  // Melhor 1RM de cada dia, do mais velho para o mais novo
  const chart = days
    .map((d) => ({ day: d.day, value: best1Rm(d.sets)?.oneRm ?? null }))
    .filter((d): d is { day: string; value: number } => d.value != null)
    .slice(0, CHART_DAYS)
    .reverse();
  const top = Math.max(...chart.map((d) => d.value), 1);
  const low = Math.min(...chart.map((d) => d.value));

  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('records.title')}
      </Text>
      <View className="gap-1">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between gap-3">
            <Text className="text-sm text-ink-muted">{label}</Text>
            <Text className="font-mono text-sm text-ink">{value}</Text>
          </View>
        ))}
      </View>
      {best && (
        <Text className="text-sm text-ink-muted">
          {t('records.oneRmFrom', {
            set: `${kg(best.set.weight_kg ?? 0)} × ${best.set.reps}`,
            day: dayOf(best.set.performed_at),
          })}
        </Text>
      )}
      {chart.length >= 2 && (
        <View className="gap-1">
          <Text className="text-sm text-ink">{t('records.chart')}</Text>
          <View className="h-24 flex-row items-end gap-1" accessibilityRole="image">
            {chart.map((d) => {
              // A barra começa abaixo do menor valor, para a diferença aparecer
              const floor = low * 0.8;
              const pct = Math.max(8, ((d.value - floor) / Math.max(top - floor, 1)) * 100);
              return (
                <View
                  key={d.day}
                  accessible
                  accessibilityLabel={t('records.chartBar', {
                    day: formatShortDate(d.day),
                    value: kg(d.value),
                  })}
                  className="flex-1 rounded-t bg-accent"
                  style={{ height: `${pct}%` }}
                />
              );
            })}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-ink-muted">{formatShortDate(chart[0].day)}</Text>
            <Text className="text-xs text-ink-muted">
              {formatShortDate(chart[chart.length - 1].day)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** Calculadora de 1RM (AC5.4): carga × repetições → 1RM e as cargas por porcentagem. */
export function OneRmCalculator() {
  const { t, i18n } = useTranslation();
  const { unit } = useGymPrefs();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const lang = i18n.language;
  const w = parseDecimal(weight);
  const r = parseDecimal(reps);
  const tooMany = r != null && r > MAX_REPS_FOR_1RM;
  const oneRmKg = w != null && r != null ? estimate1Rm(toKg(w, unit), Math.round(r)) : null;
  const number = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(v);
  const inUnit = (kgValue: number) => `${number(fromKg(kgValue, unit))} ${unit}`;

  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('records.calculator')}
      </Text>
      <View className="flex-row gap-3">
        <View className="w-32 gap-1">
          <Text className="text-xs text-ink-muted">{t('records.calcWeight')}</Text>
          <Input
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            accessibilityLabel={t('records.calcWeight')}
          />
        </View>
        <View className="w-32 gap-1">
          <Text className="text-xs text-ink-muted">{t('records.calcReps')}</Text>
          <Input
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            accessibilityLabel={t('records.calcReps')}
          />
        </View>
      </View>
      {tooMany && <Text className="text-sm text-ink-muted">{t('records.calcTooMany')}</Text>}
      {oneRmKg != null && (
        <>
          <Text className="text-base font-semibold text-ink">
            {t('records.calcResult', { value: inUnit(oneRmKg) })}
          </Text>
          <Text className="text-sm text-ink-muted">{t('records.calcTable')}</Text>
          <View className="gap-1">
            {percentTable(fromKg(oneRmKg, unit), weightStep(unit)).map((row) => (
              <View key={row.pct} className="flex-row justify-between gap-3">
                <Text className="text-sm text-ink-muted">{t('records.pct', { pct: row.pct })}</Text>
                <Text className="font-mono text-sm text-ink">{`${number(row.kg)} ${unit}`}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
