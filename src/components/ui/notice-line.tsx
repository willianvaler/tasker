import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * Aviso que pede uma decisão (treinar? revisar a semana?) como uma linha, não um cartão (D258): a
 * pergunta, uma frase de apoio e os botões, entre divisórias. O cartão grande do Início ocupava a
 * primeira dobra da tela no computador.
 */
export function NoticeLine({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  /** Os botões (o primário primeiro) */
  children: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3">
      <View className="min-w-48 flex-1 gap-1">
        <Text accessibilityRole="header" className="text-sm font-semibold text-ink">
          {title}
        </Text>
        {body && <Text className="text-sm text-ink-muted">{body}</Text>}
      </View>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
