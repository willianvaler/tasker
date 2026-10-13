import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useNotifications } from '@/lib/queries/projects';

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read_at).length ?? 0;
}

/** Sino com o número de não lidas (topo da tela Hoje). */
export function NotificationsBell() {
  const unread = useUnreadCount();
  return (
    <Link href="/notifications" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={unread ? `Notificações: ${unread} novas` : 'Notificações'}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-wash"
      >
        <Text style={{ fontSize: 20, lineHeight: 24 }}>🔔</Text>
        {unread > 0 && <Badge count={unread} className="absolute right-0 top-0" />}
      </Pressable>
    </Link>
  );
}

export function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <View
      className={cn(
        'h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1',
        className,
      )}
    >
      <Text className="text-xs font-semibold text-on-accent">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}
