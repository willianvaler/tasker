import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/**
 * Área da tela. "narrow" (formulários, detalhes) fica numa coluna confortável de ler (768 px);
 * "medium" (listas) usa até 1152 px, para a linha mostrar título e detalhes lado a lado; "wide"
 * (Início, pastas, cards, kanban, personagem, loja) usa a largura do computador para colunas e grades.
 */
export function Screen({
  children,
  size = 'narrow',
}: {
  children: ReactNode;
  /** narrow: formulários · medium: listas · wide: painéis e grades */
  size?: 'narrow' | 'medium' | 'wide';
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-paper">
      <View
        className={cn(
          'w-full flex-1 self-center px-4',
          size === 'wide'
            ? 'max-w-7xl md:px-8'
            : size === 'medium'
              ? 'max-w-6xl md:px-8'
              : 'max-w-3xl md:px-6',
        )}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
