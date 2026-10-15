import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import { localStore } from './storage';
import type { Timer } from './timers';

// Aviso do fim do timer no celular (J3, D125): notificação local agendada para o `ends_at`, que
// toca mesmo com o app fechado ou a tela bloqueada. Cada mudança do timer (aqui ou em outro
// aparelho) reagenda; parar cancela. O id da notificação é o do timer.

const ASKED_KEY = 'questlist:timer-permission-asked';
const CHANNEL = 'timers';

export const alertsSupported = true;

/** Já pedimos a permissão uma vez (a tela explica antes de pedir pela primeira vez). */
export const permissionAsked = () => localStore.getItem(ASKED_KEY) === '1';

export async function ensureAlertPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('timer.channel'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  localStore.setItem(ASKED_KEY, '1');
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return result.granted;
}

/** Texto do aviso: "Hora da próxima série: Supino reto, 3/4". */
export function alertText(timer: Timer) {
  const { label, after } = (timer.config ?? {}) as { label?: string; after?: boolean };
  if (timer.kind === 'rest')
    return {
      title: i18n.t('timer.restOver'),
      body: !label
        ? i18n.t('timer.backToIt')
        : i18n.t(after ? 'timer.nextItem' : 'timer.nextSet', { label }),
    };
  return { title: i18n.t('timer.timeUp'), body: label ?? i18n.t('timer.countdown') };
}

/** Agenda (ou reagenda) o aviso do timer; timer parado, pausado ou sem fim: cancela. */
export async function syncTimerAlert(timer: Timer | null, previousId: string | null) {
  if (previousId && previousId !== timer?.id)
    await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => {});
  if (!timer) return;
  await Notifications.cancelScheduledNotificationAsync(timer.id).catch(() => {});
  if (timer.state !== 'running' || !timer.ends_at) return;
  const at = Date.parse(timer.ends_at);
  if (at <= Date.now()) return;
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: timer.id,
    content: { ...alertText(timer), sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL,
    },
  });
}

/** Com o app aberto: vibra quando o timer chega a zero. */
export function timerFinishedHere() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
