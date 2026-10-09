import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Área da tela com largura máxima confortável no computador. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <View className="w-full max-w-2xl flex-1 self-center px-4">{children}</View>
    </SafeAreaView>
  );
}
