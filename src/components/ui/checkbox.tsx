import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

/** Caixa de marcar com área de toque de 44px (a caixa visível é menor). */
export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      // aria-* (e não accessibilityState): o react-native-web só repassa estes para o HTML
      aria-checked={checked}
      aria-disabled={disabled}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      className={cn('h-11 w-11 items-center justify-center', disabled && 'opacity-50')}
      onPress={() => onChange(!checked)}
    >
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-full border-2',
          checked ? 'border-primary bg-primary' : 'border-muted-foreground',
        )}
      >
        {checked && <Text className="text-xs font-bold text-primary-foreground">✓</Text>}
      </View>
    </Pressable>
  );
}
