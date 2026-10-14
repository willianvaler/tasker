import { Switch, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/tokens';

/** Linha de configuração com interruptor: título, explicação curta e o liga/desliga no acento. */
export function ToggleRow({
  title,
  hint,
  value,
  onChange,
  disabled,
}: {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        {hint && <Text className="text-sm text-ink-muted">{hint}</Text>}
      </View>
      <Switch
        accessibilityLabel={title}
        aria-checked={value}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor={colors.surface}
        {...({ activeThumbColor: colors.surface } as object)}
      />
    </View>
  );
}
