import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { actorCan } from '@/lib/permissions';
import { useTaskEvents } from '@/lib/queries/events';
import { useFolderActor } from '@/lib/queries/projects';
import { eventMessage } from '@/lib/task-events';
import { useIsOnline } from '@/providers/online';

/**
 * Histórico da tarefa (V3 §2.7): quem fez o quê e quando, de `task_events`. Recolhido até abrir;
 * só para quem audita o projeto (workflow.view_audit).
 */
export function TaskHistory({ taskId, folderId }: { taskId: string; folderId: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const online = useIsOnline();
  const allowed = actorCan(useFolderActor(folderId), 'workflow.view_audit');
  const events = useTaskEvents(taskId, open && allowed);
  if (!allowed) return null;
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        className="min-h-8 flex-row items-center gap-1 self-start"
      >
        <Icon icon={open ? ChevronDown : ChevronRight} size={16} tone="ink-muted" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('events.title')}
        </Text>
      </Pressable>
      {open && !online && !events.data && (
        <Text className="text-sm text-ink-muted">{t('events.offline')}</Text>
      )}
      {open && events.data?.length === 0 && (
        <Text className="text-sm text-ink-muted">{t('events.empty')}</Text>
      )}
      {open && (events.data?.length ?? 0) > 0 && (
        <View accessibilityRole="list" accessibilityLabel={t('events.title')}>
          {events.data?.map((e) => {
            const m = eventMessage(e, t('events.someone'));
            return (
              <View
                key={e.id}
                className="min-h-8 flex-row items-baseline gap-3 border-b border-line py-1"
              >
                <Text className="flex-1 text-sm text-ink">{t(m.key, m.params)}</Text>
                <Text className="font-mono text-xs text-ink-muted">
                  {when.format(new Date(e.at))}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
