import { router } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * "⚡ Modo" com texto (W7): no celular, o raio sozinho no topo da Hoje passava despercebido
 * ("não achei o botão do modo treino"). Abre o seletor de Treino, Foco e Descanso.
 */
export function ModeButton() {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('modes.open')}
      onPress={() => router.push('/modos')}
      className="min-h-11 flex-row items-center gap-1 rounded-full border border-line px-3 active:bg-wash"
    >
      <Icon icon={Zap} tone="accent" />
      <Text className="text-sm font-semibold text-ink">{t('modes.title')}</Text>
    </Pressable>
  );
}
