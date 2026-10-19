import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { describeNotification } from '@/lib/notifications';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries/projects';
import { useIsOnline } from '@/providers/online';

// Notificações in-app. Abrir a tela marca todas como lidas.
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
      <ScreenScroll contentContainerClassName="pb-12">
        {list.data?.length === 0 && <EmptyState title={t('notifications.empty')} />}
        {list.data?.map((n) => {
          const { text, taskId, folderId, teamId, teamInvite, pageId, url } =
            describeNotification(n);
          return (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              disabled={!taskId && !folderId && !teamId && !teamInvite && !pageId && !url}
              className="min-h-12 flex-row items-center gap-3 border-b border-line px-2 py-2 hover:bg-wash active:bg-wash"
              onPress={() => {
                if (url) router.push(url as Href);
                else if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
                else if (pageId) router.push({ pathname: '/page/[id]', params: { id: pageId } });
                else if (folderId)
                  router.push({ pathname: '/folder/[id]', params: { id: folderId } });
                else if (teamId) router.push({ pathname: '/team/[id]', params: { id: teamId } });
                else if (teamInvite)
                  router.push({ pathname: '/team-invite/[token]', params: { token: teamInvite } });
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
      </ScreenScroll>
    </Screen>
  );
}
