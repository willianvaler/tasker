import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { cn } from '@/lib/cn';
import { describeNotification } from '@/lib/notifications';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries/projects';
import { useIsOnline } from '@/providers/online';

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Notificações in-app (ESCOPO 4.5). Abrir a tela marca todas como lidas.
export default function NotificationsScreen() {
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const online = useIsOnline();
  const unread = list.data?.some((n) => !n.read_at) ?? false;

  useEffect(() => {
    if (unread && online && !markRead.isPending) markRead.mutate();
  }, [unread, online, markRead]);

  return (
    <Screen>
      <ScreenHeader title="Notificações" back />
      <ScrollView contentContainerClassName="pb-12">
        {list.data?.length === 0 && (
          <Text className="mt-8 text-center text-muted-foreground">
            Nada por aqui. Quando alguém te atribuir uma tarefa ou te mencionar, aparece aqui.
          </Text>
        )}
        {list.data?.map((n) => {
          const { text, taskId, folderId } = describeNotification(n);
          return (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              disabled={!taskId && !folderId}
              className="min-h-14 flex-row items-center gap-3 border-b border-border py-2 active:bg-muted"
              onPress={() => {
                if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
                else if (folderId)
                  router.push({ pathname: '/folder/[id]', params: { id: folderId } });
              }}
            >
              <View
                className={cn('h-2 w-2 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')}
              />
              <View className="flex-1">
                <Text className="text-base text-foreground">{text}</Text>
                <Text className="text-xs text-muted-foreground">
                  {WHEN.format(new Date(n.created_at))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
