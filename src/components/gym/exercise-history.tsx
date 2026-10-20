import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { convertEffort, effortLabel } from '@/lib/gym/effort';
import { groupByDay } from '@/lib/gym/history';
import { formatWeight } from '@/lib/gym/units';
import { formatDueDate } from '@/lib/parser/dates';
import { useGymPrefs, useTimeZone, useToday } from '@/lib/queries/profile';
import {
  useWorkoutHistory,
  useWorkoutSetActions,
  type WorkoutSet,
} from '@/lib/queries/workout-sets';

const PAGE = 10;

/**
 * Histórico (AC4.6, V6 §3): as sessões, do dia mais novo para o mais velho, com as séries de
 * cada uma. Pelo exercício ligado (todas as fichas e treinos) ou, sem ele, pelo item.
 */
export function ExerciseHistory({
  exerciseId,
  taskId,
  showTitle = true,
}: {
  exerciseId?: string | null;
  taskId?: string | null;
  /** Dentro de uma seção que já diz "Histórico" */
  showTitle?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const history = useWorkoutHistory({ exerciseId, taskId });
  const timeZone = useTimeZone();
  const today = useToday();
  const { unit, effort } = useGymPrefs();
  const { remove } = useWorkoutSetActions();
  const [shown, setShown] = useState(PAGE);
  const [deleting, setDeleting] = useState<WorkoutSet | null>(null);
  const lang = i18n.language;

  const days = groupByDay(history.data ?? [], timeZone);

  const describe = (s: WorkoutSet) => {
    const parts: string[] = [];
    if (s.weight_kg != null && s.reps != null)
      parts.push(`${formatWeight(s.weight_kg, unit, lang)} × ${s.reps}`);
    else if (s.reps != null) parts.push(t('workout.reps', { count: s.reps }));
    else if (s.weight_kg != null) parts.push(formatWeight(s.weight_kg, unit, lang));
    if (s.distance_m != null)
      parts.push(
        t('diary.km', {
          value: new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(
            s.distance_m / 1000,
          ),
        }),
      );
    if (s.duration_seconds != null) parts.push(t('diary.seconds', { count: s.duration_seconds }));
    if (s.effort != null && s.effort_scale) {
      const scale = effort === 'off' ? s.effort_scale : effort;
      parts.push(effortLabel(convertEffort(s.effort, s.effort_scale, scale), scale, lang));
    }
    if (s.warmup) parts.push(t('diary.warmupTag'));
    return parts.join(' · ') || '—';
  };

  return (
    <View className="gap-3">
      {showTitle && (
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('diary.history')}
        </Text>
      )}
      {days.length === 0 ? (
        <Text className="text-sm text-ink-muted">
          {history.isPending && (exerciseId || taskId) ? '…' : t('diary.historyEmpty')}
        </Text>
      ) : (
        days.slice(0, shown).map((day) => (
          <View key={day.day} className="gap-1 border-t border-line pt-2">
            <Text className="text-sm font-semibold text-ink">
              {[
                formatDueDate(day.day, today),
                t('diary.sets', { count: day.workSets }),
                day.volumeKg > 0
                  ? t('diary.volume', { volume: formatWeight(day.volumeKg, unit, lang) })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {day.sets.map((s, i) => (
              <View key={s.id} className="min-h-8 flex-row items-center gap-2">
                <Text className="w-6 text-right font-mono text-xs text-ink-muted">
                  {s.warmup ? '·' : day.sets.slice(0, i + 1).filter((x) => !x.warmup).length}
                </Text>
                <Text
                  className={s.warmup ? 'flex-1 text-sm text-ink-muted' : 'flex-1 text-sm text-ink'}
                >
                  {describe(s)}
                </Text>
                <IconButton tone="danger"
                  icon={Trash2}
                  label={t('diary.deleteSet')}
                  onPress={() => setDeleting(s)}
                />
              </View>
            ))}
          </View>
        ))
      )}
      {days.length > shown && (
        <Button
          variant="ghost"
          label={t('diary.showMore')}
          className="self-start"
          onPress={() => setShown((n) => n + PAGE)}
        />
      )}
      {deleting && (
        <ConfirmDialog destructive
          title={t('diary.deleteSetTitle')}
          message={t('diary.deleteSetBody')}
          confirmLabel={t('diary.deleteSet')}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            remove.mutate(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </View>
  );
}
