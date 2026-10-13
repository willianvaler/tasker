import { Link } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useNotifications } from '@/lib/queries/projects';

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read_at).length ?? 0;
}

/** Sino com o número de não lidas (topo da Hoje no celular). */
export function NotificationsBell() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  return (
    <Link href="/notifications" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          unread ? t('nav.notificationsUnread', { count: unread }) : t('nav.notifications')
        }
        className="h-11 w-11 items-center justify-center rounded hover:bg-wash active:bg-wash md:h-8 md:w-8"
      >
        <Icon icon={Bell} size={20} tone="ink-muted" />
        {unread > 0 && <Badge count={unread} className="absolute -right-1 -top-1" />}
      </Pressable>
    </Link>
  );
}

/** Contador pequeno no acento (mono), para não lidas. */
export function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <View
      className={cn('h-4 min-w-4 items-center justify-center rounded bg-accent px-1', className)}
    >
      <Text className="font-mono text-xs text-on-accent">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}
