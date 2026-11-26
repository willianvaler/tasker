import { router } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSensitiveConsent, useSensitiveConsentAction } from '@/lib/queries/sensitive';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Aviso fixo das telas de saúde (V15 §1.8, SA0): o Questlist guarda o que a pessoa anota, não
 * interpreta, não recomenda dose nem diagnostica.
 */
export function HealthNotice() {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="text"
      className="flex-row items-start gap-2 rounded border border-line bg-wash px-3 py-2"
    >
      <Icon icon={ShieldAlert} tone="ink-muted" size={16} />
      <Text className="flex-1 text-xs text-ink-muted">{t('health.notice')}</Text>
    </View>
  );
}

/**
 * Módulo Saúde só depois do consentimento específico (`health`, LGPD art. 11, I): o banco recusa
 * gravar sem ele. Mostra o que é guardado, onde, e como apagar.
 */
export function HealthConsentGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const consent = useSensitiveConsent('health');
  const action = useSensitiveConsentAction('health');
  const online = useIsOnline();
  const toast = useToast();
  if (consent.data === undefined) return null;
  if (consent.data) return <>{children}</>;
  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-ink">{t('health.consentTitle')}</Text>
      <Text className="text-ink">{t('health.consentBody')}</Text>
      <HealthNotice />
      <Button
        label={t('health.consentAccept')}
        className="self-start"
        disabled={!online}
        loading={action.isPending}
        onPress={() => action.mutate(true, { onError: (e) => toast({ message: e.message }) })}
      />
      {!online && <Text className="text-sm text-ink-muted">{t('body.consentOffline')}</Text>}
      <Button
        variant="ghost"
        className="self-start"
        label={t('body.consentPolicy')}
        onPress={() => router.push('/privacidade')}
      />
    </View>
  );
}
