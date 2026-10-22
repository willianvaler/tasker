import { Link, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';

/**
 * Índices de navegação (Mais, Jogo, Pessoas, Treino, Planejar; D257): linhas com ícone, nome e
 * uma dica curta, todas com texto (nada de ícone sozinho que ninguém adivinha). Linhas, não
 * cartões, como o resto do "Caderno de bolso".
 */
export function HubSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View>
      {title && <SectionLabel title={title} />}
      {children}
    </View>
  );
}

export function HubRow({
  icon,
  label,
  hint,
  href,
  onPress,
  badge,
  tone = 'ink',
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Leva a uma tela; sem href, `onPress` faz a ação */
  href?: Href;
  onPress?: () => void;
  /** Número ou aviso à direita (pedidos, não lidas) */
  badge?: string | number | null;
  tone?: 'ink' | 'danger';
}) {
  const row = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={badge ? `${label} (${badge})` : label}
      onPress={href ? undefined : onPress}
      className="min-h-12 flex-row items-center gap-3 border-b border-line px-2 hover:bg-wash active:bg-wash md:min-h-10"
    >
      <Icon icon={icon} tone={tone === 'danger' ? 'danger' : 'ink-muted'} />
      <View className="flex-1 py-2">
        <Text className={tone === 'danger' ? 'text-sm text-danger' : 'text-sm text-ink'}>
          {label}
        </Text>
        {hint && (
          <Text className="text-xs text-ink-muted" numberOfLines={2}>
            {hint}
          </Text>
        )}
      </View>
      {badge !== undefined && badge !== null && badge !== 0 && badge !== '' && (
        <Text className="font-mono text-xs text-accent">{badge}</Text>
      )}
      {href && <Icon icon={ChevronRight} tone="ink-muted" />}
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {row}
    </Link>
  ) : (
    row
  );
}
