import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { disablePush, enablePush, hasPushToken, pushSupported } from '@/lib/push';
import { useIsOnline } from '@/providers/online';

/** Perfil: avisos no celular (push). Na web, explica que os avisos ficam no 🔔. */
export function PushSetting() {
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
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">Avisos no celular</Text>
          <Text className="text-sm text-muted-foreground">
            {pushSupported
              ? 'Quando alguém te atribuir uma tarefa, te mencionar ou entrar no seu projeto.'
              : 'No navegador, os avisos aparecem no sino 🔔 (em tempo real). No app do celular, dá para receber push.'}
          </Text>
        </View>
        {pushSupported && (
          <Switch
            accessibilityLabel="Avisos no celular"
            aria-checked={enabled}
            value={enabled}
            disabled={!online || busy}
            onValueChange={toggle}
          />
        )}
      </View>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  );
}
