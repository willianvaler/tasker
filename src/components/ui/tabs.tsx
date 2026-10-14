import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

/** Abas sublinhadas (Lista · Fluxo · Pessoas · Linha do tempo). Rolam de lado no celular. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View className="border-b border-line">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View accessibilityRole="tablist" aria-label={label} className="flex-row gap-4">
          {tabs.map((tab) => {
            const active = tab.value === value;
            return (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                aria-selected={active}
                onPress={() => onChange(tab.value)}
                className={cn(
                  '-mb-px min-h-11 justify-center border-b-2 md:min-h-9',
                  active ? 'border-accent' : 'border-transparent hover:border-line',
                )}
              >
                <Text
                  className={cn('text-sm', active ? 'font-semibold text-ink' : 'text-ink-muted')}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
