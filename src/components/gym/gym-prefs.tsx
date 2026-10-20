import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { EffortSetting } from '@/lib/gym/effort';
import { parsePlates } from '@/lib/gym/plates';
import type { WeightUnit } from '@/lib/gym/types';
import { useGymPrefs, useProfile, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';
import { parseDecimal } from './set-row';

/**
 * Perfil → Registro do treino (AC4.5, V6 §3): kg ou lb e a escala de esforço. Salvo no perfil;
 * só aparece com o modo academia ligado.
 */
export function GymPrefsSettings() {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  const gymOn = useProfile().data?.gym_enabled === true;
  const prefs = useGymPrefs();
  const saved = useUiPrefs().gym ?? {};
  const update = useUpdateUiPrefs();
  // O que está sendo digitado (null: mostra o salvo)
  const [barText, setBarText] = useState<string | null>(null);
  const [platesText, setPlatesText] = useState<string | null>(null);
  if (!gymOn) return null;
  const set = (patch: {
    unit?: WeightUnit;
    effort?: EffortSetting;
    bar?: number;
    plates?: number[];
  }) => update.mutate({ gym: { ...saved, ...patch } });
  const number = (v: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(v);

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
      <View className="flex-row flex-wrap gap-3">
        <View className="w-32 gap-1">
          <Text className="text-sm text-ink">{t('plates.bar', { unit: prefs.unit })}</Text>
          <Input
            value={barText ?? number(prefs.bar)}
            onChangeText={setBarText}
            keyboardType="decimal-pad"
            editable={online}
            accessibilityLabel={t('plates.bar', { unit: prefs.unit })}
            onBlur={() => {
              if (barText == null) return;
              const v = parseDecimal(barText);
              setBarText(null);
              if (v != null) set({ bar: v });
            }}
          />
        </View>
        <View className="min-w-56 flex-1 gap-1">
          <Text className="text-sm text-ink">{t('plates.available', { unit: prefs.unit })}</Text>
          <Input
            value={platesText ?? prefs.plates.map(number).join(' ')}
            onChangeText={setPlatesText}
            editable={online}
            accessibilityLabel={t('plates.available', { unit: prefs.unit })}
            accessibilityHint={t('plates.availableHint')}
            onBlur={() => {
              if (platesText == null) return;
              const list = parsePlates(platesText);
              setPlatesText(null);
              if (list.length) set({ plates: list });
            }}
          />
          <Text className="text-xs text-ink-muted">{t('plates.availableHint')}</Text>
        </View>
      </View>
    </View>
  );
}
