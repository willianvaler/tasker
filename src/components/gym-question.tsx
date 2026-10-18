import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * "Vai usar para treinar?" (V6 §15.1). Só a apresentação: quem decide onde mostrar e o que fazer
 * com a resposta é a tela que o usa (GymPrompt no Início).
 */
export function GymQuestion({
  onAnswer,
  busy,
}: {
  onAnswer: (yes: boolean) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-4">
      <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
        {t('gymMode.title')}
      </Text>
      <Text className="text-sm text-ink-muted">{t('gymMode.body')}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button label={t('gymMode.yes')} disabled={busy} onPress={() => onAnswer(true)} />
        <Button
          variant="ghost"
          label={t('gymMode.no')}
          disabled={busy}
          onPress={() => onAnswer(false)}
        />
      </View>
    </View>
  );
}
