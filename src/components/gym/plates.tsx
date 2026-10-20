import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { plateLabel, platesPerSide } from '@/lib/gym/plates';
import { useGymPrefs } from '@/lib/queries/profile';
import { parseDecimal } from './set-row';

/** O que vai de cada lado para a carga (com a barra e as anilhas do Perfil). */
export function usePlatesText() {
  const { t, i18n } = useTranslation();
  const { bar, plates, unit } = useGymPrefs();
  const number = (v: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(v);
  return (target: number) => {
    const r = platesPerSide(target, bar, plates);
    if (r.belowBar) return t('plates.belowBar', { bar: `${number(bar)} ${unit}` });
    const main = r.perSide.length
      ? t('plates.perSide', { plates: plateLabel(r.perSide, i18n.language) })
      : t('plates.barOnly');
    return r.missing > 0
      ? `${main} · ${t('plates.missing', { value: `${number(r.missing)} ${unit}` })}`
      : main;
  };
}

/** Calculadora de anilhas (AC9.3): carga total → o que pôr de cada lado. */
export function PlateCalculator() {
  const { t } = useTranslation();
  const { unit } = useGymPrefs();
  const [text, setText] = useState('');
  const platesText = usePlatesText();
  const target = parseDecimal(text);
  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('plates.title')}
      </Text>
      <View className="w-40 gap-1">
        <Text className="text-xs text-ink-muted">{t('plates.target', { unit })}</Text>
        <Input
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          accessibilityLabel={t('plates.target', { unit })}
        />
      </View>
      {target != null && target > 0 && (
        <Text className="font-mono text-sm text-ink">{platesText(target)}</Text>
      )}
    </View>
  );
}
