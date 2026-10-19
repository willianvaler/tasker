import { AlarmClock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui/button';
import { formatDueDate } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
import { snoozeDate, type SnoozeTarget } from '@/lib/snooze';
import { useToast } from '@/providers/toast';

// Adiar (M1, D138): um toque leva a data para amanhã, com "Desfazer" no aviso.

export function useSnooze() {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const toast = useToast();
  const today = useToday();
  const run = (
    task: Pick<Task, 'id' | 'title' | 'due_date'>,
    target: SnoozeTarget = 'tomorrow',
  ) => {
    const before = task.due_date;
    const date = snoozeDate(target, today);
    update.mutate({ id: task.id, patch: { due_date: date } });
    toast({
      message: t('snooze.done', { title: task.title, date: formatDueDate(date, today) }),
      action: {
        label: t('common.undo'),
        onPress: () => update.mutate({ id: task.id, patch: { due_date: before } }),
        redo: () => run(task, target),
      },
    });
  };
  return run;
}

/** Botão da linha: só para o que vence hoje ou já venceu. */
export function SnoozeButton({ task }: { task: Task }) {
  const { t } = useTranslation();
  const snooze = useSnooze();
  return (
    <IconButton
      icon={AlarmClock}
      label={t('snooze.button', { title: task.title })}
      onPress={() => snooze(task)}
    />
  );
}
