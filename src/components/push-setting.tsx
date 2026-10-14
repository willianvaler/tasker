import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { disablePush, enablePush, hasPushToken, pushSupported } from '@/lib/push';
import { useIsOnline } from '@/providers/online';

/** Perfil: avisos no celular (push). Na web, explica que os avisos ficam no sino. */
export function PushSetting() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Liga/desliga é deste aparelho (o token fica guardado nele)
  const [enabled, setEnabled] = useState(hasPushToken);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    const result = next ? await enablePush() : (await disablePush(), { ok: true as const });
    if (!result.ok) setError(result.reason);
    setEnabled(hasPushToken());
    setBusy(false);
  }

  return (
    <View className="gap-1">
      {pushSupported ? (
        <ToggleRow
          title={t('push.title')}
          hint={t('push.hint')}
          value={enabled}
          disabled={!online || busy}
          onChange={toggle}
        />
      ) : (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">{t('push.title')}</Text>
          <Text className="text-sm text-ink-muted">{t('push.webHint')}</Text>
        </View>
      )}
      {error && <Text className="text-sm text-danger">{error}</Text>}
    </View>
  );
}
