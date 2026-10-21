import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BodyMap } from '@/components/gym/body-map';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { minutesByDay, trainingTotals, yearGrid } from '@/lib/gym/heatmap';
import {
  muscleWork,
  untrained,
  weeklyVolume,
  workLevels,
  type MuscleSlug,
} from '@/lib/gym/muscle-volume';
import { formatWeight } from '@/lib/gym/units';
import { addDays, formatShortDate } from '@/lib/parser/dates';
import { useExerciseCatalog } from '@/lib/queries/exercises';
import {
  useGymPrefs,
  useTimeZone,
  useToday,
  useUiPrefs,
  useUpdateUiPrefs,
} from '@/lib/queries/profile';
import { useAllWorkoutSets } from '@/lib/queries/workout-sets';
import { cn } from '@/lib/cn';

const PERIODS = ['week', 'month', 'all'] as const;
type Period = (typeof PERIODS)[number];
/** Tom do mapa de calor por nível (classes do tema) */
const HEAT = ['bg-wash', 'bg-accent/30', 'bg-accent/50', 'bg-accent/75', 'bg-accent'];
const VOLUME_WEEKS = 12;

/**
 * Estatísticas de treino (AC8.5, V6 §7): mapa muscular do período com os músculos sem treino, o
 * ano de treino (mapa de calor pelo tempo do dia) e o volume por semana, com o esforço médio se
 * estiver ligado. Tudo sai do diário.
 */
export default function WorkoutStatsScreen() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const timeZone = useTimeZone();
  const { unit, effort } = useGymPrefs();
  const gymPrefs = useUiPrefs().gym ?? {};
  const savePrefs = useUpdateUiPrefs();
  const figure = gymPrefs.figure === 'female' ? 'female' : 'male';
  const [period, setPeriod] = useState<Period>('week');
  const since = addDays(today, -400);
  const sets = useAllWorkoutSets(`${since}T00:00:00Z`);
  const catalog = useExerciseCatalog();
  const lang = i18n.language;

  const list = sets.data ?? [];
  const byId = new Map((catalog.data ?? []).map((e) => [e.id, e]));
  const from =
    period === 'week' ? addDays(today, -6) : period === 'month' ? addDays(today, -29) : null;
  const linked = list
    .filter((s) => s.exercise_id && byId.has(s.exercise_id))
    .map((s) => {
      const e = byId.get(s.exercise_id as string);
      return { ...s, target: e?.target ?? null, secondary: e?.secondary ?? [] };
    });
  const work = muscleWork(linked, timeZone, from);
  const levels = workLevels(work);
  const muscleName = (slug: MuscleSlug) => t(`stats.muscle_${slug}`);
  const worked = Object.keys(work).map((s) => muscleName(s as MuscleSlug));
  const missing = untrained(work).map(muscleName);

  const minutes = minutesByDay(
    list.filter((s) => !s.warmup),
    timeZone,
  );
  const grid = yearGrid(today, minutes);
  const totals = trainingTotals(minutes, from ?? addDays(today, -364), today);
  const weeks = weeklyVolume(list, timeZone, effort === 'off' ? null : effort).slice(-VOLUME_WEEKS);
  const topVolume = Math.max(1, ...weeks.map((w) => w.volumeKg));
  const hours = (m: number) =>
    m >= 60 ? t('stats.hours', { h: Math.floor(m / 60), m: m % 60 }) : `${m} min`;
  const number = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(v);

  return (
    <Screen size="wide">
      <ScreenHeader title={t('stats.title')} back />
      <ScreenScroll contentContainerClassName="gap-8 pb-12">
        <View className="flex-row flex-wrap items-center gap-2">
          <View accessibilityRole="radiogroup" className="flex-row gap-1">
            {PERIODS.map((p) => (
              <Chip
                key={p}
                role="radio"
                label={t(`stats.period_${p}`)}
                selected={period === p}
                onPress={() => setPeriod(p)}
              />
            ))}
          </View>
          <View accessibilityRole="radiogroup" className="flex-row gap-1">
            {(['male', 'female'] as const).map((f) => (
              <Chip
                key={f}
                role="radio"
                label={t(`stats.figure_${f}`)}
                selected={figure === f}
                onPress={() => savePrefs.mutate({ gym: { ...gymPrefs, figure: f } })}
              />
            ))}
          </View>
        </View>

        {list.length === 0 && !sets.isPending ? (
          <Text className="text-ink-muted">{t('stats.empty')}</Text>
        ) : (
          <>
            <Text className="text-base text-ink">
              {[
                t('stats.days', { count: totals.days }),
                t('stats.time', { value: hours(totals.minutes) }),
                t('stats.perWeek', { value: number(totals.perWeek) }),
              ].join(' · ')}
            </Text>

            <View className="gap-3 lg:flex-row lg:gap-8">
              <View className="gap-3 lg:flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t('stats.muscles')}
                </Text>
                <BodyMap
                  figure={figure}
                  levels={levels}
                  label={t('stats.mapLabel', { list: worked.join(', ') || '—' })}
                />
                {linked.length === 0 ? (
                  <Text className="text-sm text-ink-muted">{t('stats.noExercise')}</Text>
                ) : missing.length ? (
                  <Text className="text-sm text-ink-muted">
                    {t('stats.untrained', { list: missing.join(', ') })}
                  </Text>
                ) : (
                  <Text className="text-sm text-ok">{t('stats.allTrained')}</Text>
                )}
              </View>

              <View className="gap-3 lg:flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t('stats.volume')}
                </Text>
                <View className="h-40 flex-row items-end gap-1">
                  {weeks.map((w) => (
                    <View
                      key={w.week}
                      accessible
                      accessibilityLabel={[
                        t('stats.weekBar', {
                          week: w.week,
                          volume: formatWeight(w.volumeKg, unit, lang),
                          sets: t('diary.sets', { count: w.sets }),
                        }),
                        w.effort != null ? t('stats.effortAvg', { value: number(w.effort) }) : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      className="flex-1 items-center justify-end gap-1"
                    >
                      {w.effort != null && (
                        <Text className="text-xs text-ink-muted">{number(w.effort)}</Text>
                      )}
                      <View
                        className="w-full rounded-t bg-accent"
                        style={{ height: `${Math.max(4, (w.volumeKg / topVolume) * 100)}%` }}
                      />
                      <Text className="text-xs text-ink-muted">
                        {t('stats.weekShort', { n: Number(w.week.slice(-2)) })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('stats.heatmap')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-1">
                  {grid.map((week, w) => (
                    <View key={w} className="gap-1">
                      {week.map((cell, d) =>
                        cell ? (
                          <View
                            key={d}
                            accessible={cell.minutes > 0}
                            accessibilityLabel={
                              cell.minutes > 0
                                ? t('stats.heatDay', {
                                    day: formatShortDate(cell.day),
                                    count: cell.minutes,
                                  })
                                : undefined
                            }
                            className={cn('h-3 w-3 rounded', HEAT[cell.level])}
                          />
                        ) : (
                          <View key={d} className="h-3 w-3" />
                        ),
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
