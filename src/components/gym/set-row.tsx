import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { effortLabel, effortOptions, type EffortScale } from '@/lib/gym/effort';
import type { SetKind } from '@/lib/queries/workout-sets';

export type SetDraft = {
  reps: number | null;
  effort: number | null;
  /** Cardio: o que a pessoa digitou (km e minutos, com vírgula ou ponto) */
  distance: string;
  minutes: string;
};

/** "5,2" → 5.2; vazio ou estranho, null */
export const parseDecimal = (text: string) => {
  const v = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(v) && v >= 0 ? v : null;
};

/**
 * A série que está para ser feita (AC4.4, V6 §3): o Modo Treino já vem com o previsto e mudar é
 * um toque. Repetições com −/+, esforço (se ligado no Perfil) e, no cardio, distância e tempo.
 * A carga real da série fica no −/+ de baixo, no Modo Treino (AC4.7).
 */
export function SetRow({
  kind,
  draft,
  onChange,
  effortScale,
  disabled,
}: {
  kind: SetKind;
  draft: SetDraft;
  onChange: (draft: SetDraft) => void;
  effortScale: EffortScale | null;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const reps = draft.reps ?? 0;

  return (
    <View className="gap-3">
      {kind === 'reps' && (
        <View className="flex-row items-center justify-center gap-3">
          <Button
            variant="ghost"
            label="−1"
            accessibilityLabel={t('diary.fewer')}
            disabled={disabled || reps <= 0}
            onPress={() => onChange({ ...draft, reps: Math.max(0, reps - 1) })}
          />
          <Text
            className="min-w-20 text-center font-mono text-base text-ink"
            accessibilityLabel={t('diary.reps', { count: reps })}
          >
            {t('workout.reps', { count: reps })}
          </Text>
          <Button
            variant="ghost"
            label="+1"
            accessibilityLabel={t('diary.more')}
            disabled={disabled || reps >= 1000}
            onPress={() => onChange({ ...draft, reps: reps + 1 })}
          />
        </View>
      )}

      {kind === 'cardio' && (
        <View className="flex-row justify-center gap-3">
          <View className="w-32 gap-1">
            <Text className="text-xs text-ink-muted">{t('diary.distance')}</Text>
            <Input
              value={draft.distance}
              onChangeText={(distance) => onChange({ ...draft, distance })}
              keyboardType="decimal-pad"
              accessibilityLabel={t('diary.distance')}
              editable={!disabled}
            />
          </View>
          <View className="w-32 gap-1">
            <Text className="text-xs text-ink-muted">{t('diary.minutes')}</Text>
            <Input
              value={draft.minutes}
              onChangeText={(minutes) => onChange({ ...draft, minutes })}
              keyboardType="decimal-pad"
              accessibilityLabel={t('diary.minutes')}
              editable={!disabled}
            />
          </View>
        </View>
      )}

      {effortScale && (
        <View className="items-center gap-1">
          <Text className="text-xs text-ink-muted">{t('diary.effortPick')}</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-center gap-1">
            {effortOptions(effortScale).map((value) => (
              <Chip
                key={value}
                role="radio"
                label={
                  draft.effort === value
                    ? effortLabel(value, effortScale, i18n.language)
                    : new Intl.NumberFormat(i18n.language).format(value)
                }
                selected={draft.effort === value}
                disabled={disabled}
                onPress={() =>
                  onChange({ ...draft, effort: draft.effort === value ? null : value })
                }
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
