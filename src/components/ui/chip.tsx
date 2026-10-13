import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

/** Opção selecionável (etiqueta, filtro, escolha): fundo sutil, ativa no `accent-soft`. */
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
        // 44 px de toque no celular, 28 no computador; cantos de 4 px, sem borda (fundo `wash`)
        'min-h-11 justify-center rounded px-3 md:min-h-7 md:px-2',
        selected ? 'bg-accent-soft' : 'bg-wash hover:bg-line',
        disabled && 'opacity-40',
      )}
    >
      <Text className={cn('text-sm', selected ? 'font-semibold text-accent' : 'text-ink')}>
        {label}
      </Text>
    </Pressable>
  );
}
