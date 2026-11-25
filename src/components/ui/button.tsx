import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, View, type PressableProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';

type Variant = 'primary' | 'ghost';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
  /** Apagar, remover, sair: em vermelho (pedido do dono, 20/10) */
  destructive?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading,
  disabled,
  className,
  destructive,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const primary = variant === 'primary';
  const fg =
    primary && disabled ? 'ink-muted' : primary ? 'on-accent' : destructive ? 'danger' : 'ink';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(
        'min-h-11 flex-row items-center justify-center gap-2 rounded px-3 md:min-h-8',
        // Primário desabilitado: contorno e texto apagado, sem o acento (o laranja claro parecia
        // ativo); carregando continua no acento, com o indicador
        primary && disabled && !loading
          ? 'border border-line'
          : primary
            ? cn(destructive ? 'bg-danger' : 'bg-accent', 'hover:opacity-90 active:opacity-80')
            : 'hover:bg-wash active:bg-wash',
        (disabled || loading) && 'opacity-40',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg]} />
      ) : (
        <>
          {icon && <Icon icon={icon} size={16} tone={fg} />}
          <Text
            className={cn(
              'text-sm font-semibold',
              primary && disabled
                ? 'text-ink-muted'
                : primary
                  ? 'text-on-accent'
                  : destructive
                    ? 'text-danger'
                    : 'text-ink',
            )}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  tone = 'ink-muted',
  className,
  ...props
}: PressableProps & {
  icon: LucideIcon;
  label: string;
  tone?: 'ink' | 'ink-muted' | 'accent' | 'danger';
  className?: string;
}) {
  // Na web, o nome aparece ao parar o mouse em cima (avaliação de UX, M2: ícones sem rótulo). O
  // `title` nativo não entra no texto da página
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current as unknown as HTMLElement | null;
    el?.setAttribute?.('title', label);
  }, [label]);
  return (
    <Pressable
      ref={ref}
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
