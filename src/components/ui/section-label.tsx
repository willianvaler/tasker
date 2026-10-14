import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

export function SectionLabel({
  title,
  count,
  tone = 'muted',
  right,
  className,
}: {
  title: string;
  count?: string | number;
  tone?: 'muted' | 'warn';
  right?: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn('flex-row items-center gap-2 border-b border-line pb-2 pt-6', className)}
      // Não é heading: competiria com o título da tela
      accessibilityLabel={count !== undefined && count !== '' ? `${title} ${count}` : undefined}
    >
      <Text
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          tone === 'warn' ? 'text-warn' : 'text-ink-muted',
        )}
      >
        {title}
      </Text>
      {count !== undefined && <Text className="font-mono text-xs text-ink-muted">{count}</Text>}
      {right && <View className="ml-auto">{right}</View>}
    </View>
  );
}
