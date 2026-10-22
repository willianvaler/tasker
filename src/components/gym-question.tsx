import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NoticeLine } from '@/components/ui/notice-line';

/**
 * "Vai usar para treinar?" (V6 §15.1). Só a apresentação: quem decide onde mostrar e o que fazer
 * com a resposta é a tela que o usa (GymPrompt na Hoje).
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
    <NoticeLine title={t('gymMode.title')} body={t('gymMode.body')}>
      <Button label={t('gymMode.yes')} disabled={busy} onPress={() => onAnswer(true)} />
      <Button
        variant="ghost"
        label={t('gymMode.no')}
        disabled={busy}
        onPress={() => onAnswer(false)}
      />
    </NoticeLine>
  );
}
