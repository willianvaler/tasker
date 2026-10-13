import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';

// Só duas variantes (V3 §0.3): primário (fundo do acento) e fantasma (sem fundo, hover sutil).
// "Apagar" é um primário dentro do diálogo de confirmação, que já diz o que vai acontecer.
type Variant = 'primary' | 'ghost';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(
        // 44 px no celular (alvo de toque), 32 px no computador
        'min-h-11 flex-row items-center justify-center gap-2 rounded px-3 md:min-h-8',
        primary ? 'bg-accent hover:opacity-90 active:opacity-80' : 'hover:bg-wash active:bg-wash',
        (disabled || loading) && 'opacity-40',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors['on-accent'] : colors.ink} />
      ) : (
        <>
          {icon && <Icon icon={icon} size={16} tone={primary ? 'on-accent' : 'ink'} />}
          <Text className={cn('text-sm font-semibold', primary ? 'text-on-accent' : 'text-ink')}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Botão só de ícone (32 px no computador, 44 no celular), sempre com rótulo acessível. */
export function IconButton({
  icon,
  label,
  tone = 'ink-muted',
  className,
  ...props
}: PressableProps & {
  icon: LucideIcon;
  label: string;
  tone?: 'ink' | 'ink-muted' | 'accent';
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'h-11 w-11 items-center justify-center rounded hover:bg-wash active:bg-wash md:h-8 md:w-8',
        props.disabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      <Icon icon={icon} size={20} tone={tone} />
    </Pressable>
  );
}
