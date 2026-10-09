import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

/** Opção selecionável em formato de pílula (alvo de toque de 44px). */
export function Chip({
  label,
  selected,
  disabled,
  onPress,
  role = 'button',
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  role?: 'button' | 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      aria-selected={role === 'button' ? !!selected : undefined}
      aria-checked={role === 'button' ? undefined : !!selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-11 justify-center rounded-full border px-3',
        selected ? 'border-primary bg-primary' : 'border-border',
        disabled && 'opacity-50',
      )}
    >
      <Text className={selected ? 'text-primary-foreground' : 'text-foreground'}>{label}</Text>
    </Pressable>
  );
}
