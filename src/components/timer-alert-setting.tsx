import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, BatteryCharging, Bell, BellRing } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { alertPermission, canVibrate, ensureAlertPermission, testAlert } from '@/lib/timer-alerts';

import { WorkoutLive } from '../../modules/workout-live';

// Perfil → Avisos (U5, D156): o estado da permissão de notificação deste aparelho/navegador,
// pedir sem precisar iniciar um timer e testar som, vibração e notificação de uma vez. No Android
// com o módulo nativo, também alarme exato e otimização de bateria: sem eles, com a tela desligada
// o aviso atrasa e o Android Go congela o app (Moto E14).

type DeviceExtras = { exact: boolean; battery: boolean };

function deviceExtras(): DeviceExtras | null {
  if (Platform.OS !== 'android' || !WorkoutLive) return null;
  return { exact: WorkoutLive.canExactAlarms(), battery: WorkoutLive.ignoresBatteryOptimizations() };
}

export function TimerAlertSetting() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: ['alert-permission'],
    queryFn: alertPermission,
    networkMode: 'always',
    staleTime: 0,
  });
  const extras = useQuery({
    queryKey: ['alert-device-extras'],
    queryFn: deviceExtras,
    networkMode: 'always',
    staleTime: 0,
  });
  const state = permission.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['alert-permission'] });

  // A pessoa liga nos ajustes do sistema e volta: confere de novo
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      queryClient.invalidateQueries({ queryKey: ['alert-permission'] });
      queryClient.invalidateQueries({ queryKey: ['alert-device-extras'] });
    });
    return () => sub.remove();
  }, [queryClient]);
  const device = extras.data;

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
      {device && !device.exact && (
        <Text className="text-sm text-warn">{t('alerts.exactOff')}</Text>
      )}
      {device && !device.battery && (
        <Text className="text-sm text-ink-muted">{t('alerts.batteryOn')}</Text>
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
        {device && !device.exact && (
          <Button
            variant="ghost"
            icon={AlarmClock}
            label={t('alerts.exactAllow')}
            onPress={() => WorkoutLive?.openExactAlarmSettings()}
          />
        )}
        {device && !device.battery && (
          <Button
            variant="ghost"
            icon={BatteryCharging}
            label={t('alerts.batteryOpen')}
            onPress={() => WorkoutLive?.openBatterySettings()}
          />
        )}
      </View>
    </View>
  );
}
