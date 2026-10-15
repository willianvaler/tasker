import { router } from 'expo-router';
import { ArrowDown, ArrowUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { TaskRow } from '@/components/tasks/task-row';
import { IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useMyDay, useMyDayActions } from '@/lib/queries/my-day';
import type { Task } from '@/lib/queries/tasks';
import { nextAction, remainingEstimate } from '@/lib/next-action';
import { localStore } from '@/lib/storage';
import { formatDuration, parseDuration } from '@/lib/task-tree';

// Meu dia e Próxima ação (M4, D141).

/** "Fazer agora": a sugestão entre o Meu dia e o que vence (atrasadas e hoje). */
export function NextActionCard({ tasks, today }: { tasks: readonly Task[]; today: string }) {
  const { t } = useTranslation();
  const myDay = useMyDay(today);
  const day = (myDay.data ?? []).map((i) => i.task);
  const all = [...day, ...tasks.filter((x) => !day.some((d) => d.id === x.id))];
  const next = nextAction(
    all,
    day.map((x) => x.id),
    today,
  );
  if (!next) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('myDay.nextLabel', { title: next.title })}
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: next.id } })}
      className="gap-1 rounded-lg border border-accent px-3 py-2 hover:bg-wash"
    >
      <Text className="text-base text-ink" numberOfLines={2}>
        {t('myDay.nextLabel', { title: next.title })}
      </Text>
    </Pressable>
  );
}

const availableKey = (day: string) => `questlist:available:${day}`;

/** As tarefas escolhidas para hoje, na ordem, com o tempo que falta × o disponível. */
export function MyDaySection({ today }: { today: string }) {
  const { t } = useTranslation();
  const myDay = useMyDay(today);
  const actions = useMyDayActions(today);
  const items = myDay.data ?? [];
  const [available, setAvailable] = useState(() => {
    try {
      return localStore.getItem(availableKey(today)) ?? '';
    } catch {
      return '';
    }
  });
  if (items.length === 0) return null;
  const left = remainingEstimate(items.map((i) => i.task));
  const minutes = parseDuration(available);
  const over = minutes != null && left > minutes;
  return (
    <View>
      <SectionLabel
        title={t('myDay.title')}
        count={String(items.filter((i) => i.task.status !== 'done').length)}
      />
      <View className="flex-row flex-wrap items-center gap-2 pb-2">
        <Text className={over ? 'text-sm text-warn' : 'text-sm text-ink-muted'}>
          {minutes != null
            ? t('myDay.leftOf', { left: formatDuration(left), available: formatDuration(minutes) })
            : t('myDay.left', { left: formatDuration(left) })}
        </Text>
        <Input
          className="w-28"
          value={available}
          onChangeText={(text) => {
            setAvailable(text);
            try {
              localStore.setItem(availableKey(today), text);
            } catch {
              // Só conveniência do aparelho
            }
          }}
          placeholder={t('myDay.availablePlaceholder')}
          accessibilityLabel={t('myDay.available')}
          maxLength={8}
        />
      </View>
      {items.map((item, i) => (
        <View key={item.id} className="flex-row items-center">
          <View className="flex-1">
            <TaskRow task={item.task} today={today} />
          </View>
          <IconButton
            icon={ArrowUp}
            label={t('myDay.up', { title: item.task.title })}
            disabled={i === 0}
            onPress={() => actions.move.mutate({ id: item.id, delta: -1 })}
          />
          <IconButton
            icon={ArrowDown}
            label={t('myDay.down', { title: item.task.title })}
            disabled={i === items.length - 1}
            onPress={() => actions.move.mutate({ id: item.id, delta: 1 })}
          />
          <IconButton
            icon={X}
            label={t('myDay.remove', { title: item.task.title })}
            onPress={() => actions.remove.mutate(item.id)}
          />
        </View>
      ))}
    </View>
  );
}

/** No painel: pôr ou tirar a tarefa do Meu dia de hoje. */
export function useMyDayToggle(today: string) {
  const myDay = useMyDay(today);
  const actions = useMyDayActions(today);
  return {
    has: (taskId: string) => !!myDay.data?.some((i) => i.task.id === taskId),
    toggle: (taskId: string) => {
      const item = myDay.data?.find((i) => i.task.id === taskId);
      if (item) actions.remove.mutate(item.id);
      else actions.add.mutate(taskId);
    },
  };
}
