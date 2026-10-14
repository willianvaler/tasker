import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { HARD_MAX_DEPTH, MIN_MAX_DEPTH } from '@/config/limits';

const LEVELS = Array.from(
  { length: HARD_MAX_DEPTH - MIN_MAX_DEPTH + 1 },
  (_, i) => MIN_MAX_DEPTH + i,
);

/** Limite de níveis de subtarefa: "Padrão" (herda) ou de 2 a 6. */
export function DepthPicker({
  value,
  inherited,
  onChange,
  disabled,
}: {
  value: number | null | undefined;
  /** O que vale quando fica no padrão (o do projeto, ou 5) */
  inherited: number;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-row flex-wrap gap-2"
      accessibilityRole="radiogroup"
      accessibilityLabel={t('tree.depthLimit')}
    >
      <Chip
        role="radio"
        label={t('tree.depthDefault', { count: inherited })}
        selected={value == null}
        disabled={disabled}
        onPress={() => onChange(null)}
      />
      {LEVELS.map((level) => (
        <Chip
          key={level}
          role="radio"
          label={String(level)}
          selected={value === level}
          disabled={disabled}
          onPress={() => onChange(level)}
        />
      ))}
    </View>
  );
}
