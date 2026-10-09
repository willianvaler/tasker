import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'destructive';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

const container: Record<Variant, string> = {
  primary: 'bg-primary active:opacity-80',
  ghost: 'bg-transparent active:bg-muted',
  outline: 'border border-border bg-background active:bg-muted',
  destructive: 'bg-destructive active:opacity-80',
};
const text: Record<Variant, string> = {
  primary: 'text-primary-foreground',
  ghost: 'text-primary',
  outline: 'text-foreground',
  destructive: 'text-white',
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
