import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/members';

export function Avatar({ name, size = 20 }: { name: string; size?: 20 | 32 }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        'items-center justify-center rounded-full border border-line bg-wash',
        size === 20 ? 'h-5 w-5' : 'h-8 w-8',
      )}
    >
      <Text className="text-xs font-semibold text-ink-muted">
        {/* No de 20 px cabe só uma letra na escala de 12 px */}
        {size === 20 ? initials(name).slice(0, 1) : initials(name)}
      </Text>
    </View>
  );
}

export function PersonRow({
  name,
  detail,
  right,
}: {
  name: string;
  detail?: string;
  right?: ReactNode;
}) {
  return (
    <View className="min-h-12 flex-row items-center gap-3 border-b border-line md:min-h-10">
      <Avatar name={name} size={32} />
      <View className="flex-1">
        <Text className="text-sm text-ink" numberOfLines={1}>
          {name}
        </Text>
        {detail && <Text className="font-mono text-xs text-ink-muted">{detail}</Text>}
      </View>
      {right}
    </View>
  );
}
