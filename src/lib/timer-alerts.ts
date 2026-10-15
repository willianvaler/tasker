import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

import i18n from '@/i18n';

import { localStore } from './storage';
import { alertText } from './timer-text';
import type { Timer } from './timers';

// Aviso do fim do timer no celular (J3, D125): notificação local agendada para o `ends_at`, que
// toca mesmo com o app fechado ou a tela bloqueada. Cada mudança do timer (aqui ou em outro
// aparelho) reagenda; parar cancela. O id da notificação é o do timer.

const ASKED_KEY = 'questlist:timer-permission-asked';
// Canal novo (v2): o Android não deixa mudar a vibração de um canal que já existe
const CHANNEL = 'timers-v2';
/** Espera, vibra, pausa, vibra (ms) */
const PATTERN = [0, 300, 150, 300];

export const alertsSupported = true;
/** Vibração: no celular, sempre (expo-haptics). */
export const canVibrate = () => true;
/** Som: no celular, quem toca é a notificação. */
export function primeAudio() {}

/** Já pedimos a permissão uma vez (a tela explica antes de pedir pela primeira vez). */
export const permissionAsked = () => localStore.getItem(ASKED_KEY) === '1';

export async function ensureAlertPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('timer.channel'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: PATTERN,
      enableVibrate: true,
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

/**
 * Com o app aberto: vibra de verdade quando o timer chega a zero (U6). O `Haptics` sozinho é um
 * toque leve, fácil de não sentir com o celular no bolso ou na mesa.
 */
export function timerFinishedHere(_timerId: string) {
  vibrate();
}

function vibrate() {
  // No iPhone o padrão é ignorado (vibração fixa do sistema); o toque do Haptics reforça
  Vibration.vibrate(Platform.OS === 'android' ? PATTERN : 400);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export type AlertPermission = 'granted' | 'denied' | 'default' | 'unsupported';

/** Estado da permissão de notificação no aparelho (U5) */
export async function alertPermission(): Promise<AlertPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'default' : 'denied';
}

/** "Testar aviso" no Perfil: vibra agora e mostra uma notificação de teste */
export async function testAlert(text: { title: string; body: string }) {
  vibrate();
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'questlist-test',
    content: { ...text, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: CHANNEL,
    },
  });
}
