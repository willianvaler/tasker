import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Moldura das páginas de convite abertas fora do login (projeto, clã, time, amizade, lista
 * enviada, desafio): coluna estreita no meio da tela, que rola e sobe com o teclado (o formulário
 * de criar conta aparece nelas).
 */
export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow items-center justify-center px-6 py-12"
        >
          <View className="w-full max-w-sm gap-4">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
