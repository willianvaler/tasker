import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import type { EffortSetting } from '@/lib/gym/effort';
import type { WeightUnit } from '@/lib/gym/types';
import { useGymPrefs, useProfile, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';

/**
 * Perfil → Registro do treino (AC4.5, V6 §3): kg ou lb e a escala de esforço. Salvo no perfil;
 * só aparece com o modo academia ligado.
 */
export function GymPrefsSettings() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const gymOn = useProfile().data?.gym_enabled === true;
  const prefs = useGymPrefs();
  const saved = useUiPrefs().gym ?? {};
  const update = useUpdateUiPrefs();
  if (!gymOn) return null;
  const set = (patch: { unit?: WeightUnit; effort?: EffortSetting }) =>
    update.mutate({ gym: { ...saved, ...patch } });

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm text-ink">{t('diary.unit')}</Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {(['kg', 'lb'] as const).map((unit) => (
            <Chip
              key={unit}
              role="radio"
              label={unit}
              selected={prefs.unit === unit}
              disabled={!online}
              onPress={() => set({ unit })}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm text-ink">{t('diary.effort')}</Text>
        <Text className="text-sm text-ink-muted">{t('diary.effortHint')}</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {(['off', 'rir', 'rpe'] as const).map((effort) => (
            <Chip
              key={effort}
              role="radio"
              label={t(
                effort === 'off'
                  ? 'diary.effortOff'
                  : effort === 'rir'
                    ? 'diary.effortRir'
                    : 'diary.effortRpe',
              )}
              selected={prefs.effort === effort}
              disabled={!online}
              onPress={() => set({ effort })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
