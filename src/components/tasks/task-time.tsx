import { Timer as TimerIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { usePomodoro } from '@/components/timer-bar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { estimatedPomodoros } from '@/lib/pomodoro';
import { useTaskTime } from '@/lib/queries/pomodoro';
import type { Task } from '@/lib/queries/tasks';

// Tempo da tarefa no painel (K, D129): pomodoro e quantos já foram (de quantos estimados).

export function TaskTime({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { t } = useTranslation();
  const pomodoro = usePomodoro();
  const entries = useTaskTime(task.id);
  const done = (entries.data ?? []).filter((e) => e.source === 'pomodoro').length;
  const estimated = estimatedPomodoros(task.estimate_minutes, pomodoro.settings.focus_minutes);
  return (
    <View className="flex-row flex-wrap items-center gap-3">
      <Button
        variant="ghost"
        icon={TimerIcon}
        label={t('pomodoro.start')}
        disabled={disabled}
        onPress={() => pomodoro.start({ id: task.id, title: task.title })}
      />
      <Text className="font-mono text-xs text-ink-muted">
        {estimated ? t('pomodoro.countOf', { done, estimated }) : t('pomodoro.count', { done })}
      </Text>
    </View>
  );
}
