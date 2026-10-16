import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { alertPermission, canVibrate, ensureAlertPermission, testAlert } from '@/lib/timer-alerts';

// Perfil → Avisos (U5, D156): o estado da permissão de notificação deste aparelho/navegador,
// pedir sem precisar iniciar um timer e testar som, vibração e notificação de uma vez.

export function TimerAlertSetting() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: ['alert-permission'],
    queryFn: alertPermission,
    networkMode: 'always',
    staleTime: 0,
  });
  const state = permission.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['alert-permission'] });

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink">{t('alerts.title')}</Text>
      {state && (
        <Text className={state === 'denied' ? 'text-sm text-warn' : 'text-sm text-ink-muted'}>
          {/* Y2 (#11): bloqueado explica só o caminho da plataforma em uso */}
          {state === 'denied'
            ? t(Platform.OS === 'web' ? 'alerts.deniedWeb' : 'alerts.deniedApp')
            : t(`alerts.${state}`)}
          {Platform.OS === 'web' && !canVibrate() ? ` ${t('alerts.noVibration')}` : ''}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {state === 'default' && (
          <Button
            icon={Bell}
            label={t('alerts.allow')}
            onPress={() => ensureAlertPermission().finally(refresh)}
          />
        )}
        <Button
          variant="ghost"
          icon={BellRing}
          label={t('alerts.test')}
          onPress={() =>
            testAlert({ title: t('alerts.testTitle'), body: t('alerts.testBody') }).finally(refresh)
          }
        />
      </View>
    </View>
  );
}
