import i18n from '@/i18n';

import { show } from './timer-alerts.web';

// Lembretes de tarefa na web (D206): enquanto o app está aberto, um aviso do navegador na hora
// (com a permissão já dada no Perfil ou no timer). Com o app fechado vale o 🔔 do servidor.

export type ReminderItem = { id: string; title: string; at: number; time: string };

const pending = new Map<string, ReturnType<typeof setTimeout>>();
/** O setTimeout não aguenta esperas muito longas; o que passa de 1 dia é agendado depois. */
const MAX_WAIT = 24 * 60 * 60 * 1000;

export async function syncReminders(items: ReminderItem[]) {
  for (const handle of pending.values()) clearTimeout(handle);
  pending.clear();
  for (const r of items) {
    const wait = r.at - Date.now();
    if (wait <= 0 || wait > MAX_WAIT) continue;
    pending.set(
      r.id,
      setTimeout(() => {
        pending.delete(r.id);
        show(
          {
            title: i18n.t('reminders.notifyTitle', { time: r.time, title: r.title }),
            body: i18n.t('reminders.notifyBody'),
          },
          `rem:${r.id}`,
        ).catch(() => {});
      }, wait),
    );
  }
}
