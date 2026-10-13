import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

export function ScreenHeader({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-1 py-2">
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-wash"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Text className="text-xl text-ink">‹</Text>
        </Pressable>
      )}
      <Text
        className="flex-1 text-xl font-semibold text-ink"
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
