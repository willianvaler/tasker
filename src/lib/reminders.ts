import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

// Lembretes de tarefa no celular (D206): notificação local agendada, que toca sem internet e com o
// app fechado. Cada lista de lembretes nova reagenda (cancela os que saíram). O id é "rem:<tarefa>".

const CHANNEL = 'reminders-v1';
const PREFIX = 'rem:';

export type ReminderItem = { id: string; title: string; at: number; time: string };

let channelReady = false;

export async function syncReminders(items: ReminderItem[]) {
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    if (items.length === 0 || current.canAskAgain === false) return;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    if (!asked.granted) return;
  }
  if (Platform.OS === 'android' && !channelReady) {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('reminders.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelReady = true;
  }
  const wanted = new Map(items.filter((r) => r.at > Date.now()).map((r) => [PREFIX + r.id, r]));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (!n.identifier.startsWith(PREFIX)) continue;
    const want = wanted.get(n.identifier);
    const at = (n.trigger as { value?: number; date?: number } | null)?.value;
    // Igual ao agendado: deixa; mudou ou saiu: cancela (e reagenda abaixo, se ainda vale)
    if (want && at === want.at) wanted.delete(n.identifier);
    else await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }
  for (const [identifier, r] of wanted)
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: i18n.t('reminders.notifyTitle', { time: r.time, title: r.title }),
        body: i18n.t('reminders.notifyBody'),
        sound: true,
        data: { url: `/task/${r.id}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: CHANNEL,
      },
    });
}
