import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'destructive';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

const container: Record<Variant, string> = {
  primary: 'bg-accent active:opacity-80',
  ghost: 'bg-transparent active:bg-wash',
  outline: 'border border-line bg-paper active:bg-wash',
  destructive: 'bg-danger active:opacity-80',
};
const text: Record<Variant, string> = {
  primary: 'text-on-accent',
  ghost: 'text-accent',
  outline: 'text-ink',
  destructive: 'text-on-accent',
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(
        // min-h-11 = 44px, alvo de toque mínimo do escopo
        'min-h-11 flex-row items-center justify-center rounded-lg px-4',
        container[variant],
        (disabled || loading) && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text className={cn('text-base font-semibold', text[variant])}>{label}</Text>
      )}
    </Pressable>
  );
}
