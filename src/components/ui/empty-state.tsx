import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/tokens';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const colors = useColors();
  return (
    <View className="items-center gap-3 py-12">
      <Svg width={56} height={56} viewBox="0 0 56 56" aria-hidden>
        <Path
          d="M14 8h22l8 8v32H14Z M36 8v8h8 M20 26h16 M20 33h12 M20 40h8"
          stroke={colors.line}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M33 39c2 2 3 3.5 4 5 2.5-5 5.5-8.5 9-11"
          stroke={colors.accent}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Text className="text-center text-sm text-ink">{title}</Text>
      {hint && <Text className="max-w-xs text-center text-xs text-ink-muted">{hint}</Text>}
    </View>
  );
}
