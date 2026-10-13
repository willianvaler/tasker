import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * Cabeçalho de tela (docs/mockups): linha de contexto pequena em mono e caixa-alta (data, caminho,
 * resumo), título serifado de 28 px e as ações à direita.
 */
export function ScreenHeader({
  title,
  eyebrow,
  back,
  icon,
  right,
}: {
  title: string;
  /** Contexto acima do título: "TER, 13 OUT", "PASTAS / MERCADO" */
  eyebrow?: string;
  back?: boolean;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-end gap-2 pb-4 pt-4 md:pt-8">
      {back && (
        <View className="-ml-3 md:-ml-2">
          <IconButton
            icon={ChevronLeft}
            label={t('common.back')}
            tone="ink"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      )}
      <View className="flex-1">
        {eyebrow && (
          <Text className="font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
            {eyebrow}
          </Text>
        )}
        <View className="flex-row items-center gap-2">
          {icon}
          <Text
            className="flex-1 font-serif text-xl text-ink"
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>
      </View>
      {right && <View className="flex-row items-center gap-1">{right}</View>}
    </View>
  );
}
