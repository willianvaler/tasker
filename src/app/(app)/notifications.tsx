import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { describeNotification } from '@/lib/notifications';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries/projects';
import { useIsOnline } from '@/providers/online';

// Notificações in-app (ESCOPO 4.5). Abrir a tela marca todas como lidas.
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const online = useIsOnline();
  const unread = list.data?.some((n) => !n.read_at) ?? false;

  useEffect(() => {
    if (unread && online && !markRead.isPending) markRead.mutate();
  }, [unread, online, markRead]);

  return (
    <Screen size="medium">
      <ScreenHeader title={t('notifications.title')} back />
      <ScrollView contentContainerClassName="pb-12">
        {list.data?.length === 0 && <EmptyState title={t('notifications.empty')} />}
        {list.data?.map((n) => {
          const { text, taskId, folderId } = describeNotification(n);
          return (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              disabled={!taskId && !folderId}
              className="min-h-12 flex-row items-center gap-3 border-b border-line py-2 hover:bg-wash active:bg-wash"
              onPress={() => {
                if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
                else if (folderId)
                  router.push({ pathname: '/folder/[id]', params: { id: folderId } });
              }}
            >
              <View
                accessibilityLabel={n.read_at ? undefined : t('notifications.unread')}
                className={cn('h-2 w-2 rounded-full', n.read_at ? 'bg-transparent' : 'bg-accent')}
              />
              <Text className="flex-1 text-sm text-ink">{text}</Text>
              <Text className="font-mono text-xs text-ink-muted">
                {when.format(new Date(n.created_at))}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
