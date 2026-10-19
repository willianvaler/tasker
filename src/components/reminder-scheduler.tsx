import { useEffect } from 'react';

import { addDays } from '@/lib/parser/dates';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import { useTodayTasks, useUpcomingTasks } from '@/lib/queries/tasks';
import { reminderAt } from '@/lib/reminder-time';
import { syncReminders, type ReminderItem } from '@/lib/reminders';

/**
 * Mantém agendados os lembretes das tarefas com horário (D206) de hoje e dos próximos 7 dias: no
 * celular, notificações locais; na web, aviso do navegador com o app aberto.
 */
export function ReminderScheduler() {
  const today = useToday();
  const timeZone = useTimeZone();
  const now = useTodayTasks(today);
  const upcoming = useUpcomingTasks(today, addDays(today, 7));
  const tasks = [...(now.data ?? []), ...(upcoming.data ?? [])];
  const items: ReminderItem[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id) || task.status === 'done') continue;
    seen.add(task.id);
    const at = reminderAt(task, timeZone);
    if (at != null)
      items.push({ id: task.id, title: task.title, at, time: (task.due_time ?? '').slice(0, 5) });
  }
  // Só reagenda quando o conjunto muda de verdade
  const signature = items
    .map((r) => `${r.id}@${r.at}:${r.title}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (now.isPending || upcoming.isPending) return;
    syncReminders(items).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, now.isPending, upcoming.isPending]);
  return null;
}
