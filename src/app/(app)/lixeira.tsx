import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { keys } from '@/lib/queries/keys';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const KINDS = {
  folders: 'trash.kindFolder',
  pages: 'trash.kindPage',
  tasks: 'trash.kindTask',
  task_assignees: 'trash.kindAssignee',
  comments: 'trash.kindComment',
  expenses: 'trash.kindExpense',
} as const;

// Fica no servidor (não no banco do aparelho): o que foi apagado já saiu do sync
export default function TrashScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ['trash'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('trash_list');
      if (error) throw error;
      return [...data].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    },
  });
  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restore_deleted', { p_id: id });
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const item = items.data?.find((i) => i.id === id);
      toast({ message: t('trash.restored', { title: item?.title ?? '' }) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: keys.tree });
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });

  return (
    <Screen size="medium">
      <ScreenHeader title={t('trash.title')} back />
      <ScreenScroll contentContainerClassName="gap-2 pb-12">
        <Text className="text-sm text-ink-muted">{t('trash.intro')}</Text>
        {!online && <Text className="text-sm text-warn">{t('trash.offline')}</Text>}
        {items.data?.length === 0 && <EmptyState title={t('trash.empty')} />}
        {items.data?.map((item) => (
          <View
            key={item.id}
            className="min-h-12 flex-row items-center gap-3 border-b border-line py-2"
          >
            <View className="flex-1">
              <Text className="text-sm text-ink" numberOfLines={1}>
                {item.title || t('trash.untitled')}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {t(KINDS[item.kind as keyof typeof KINDS] ?? 'trash.kindTask')}
                {item.items > 1 ? ` · ${t('trash.withItems', { count: item.items - 1 })}` : ''}
                {' · '}
                {new Date(item.deleted_at).toLocaleDateString()}
              </Text>
            </View>
            <Button
              variant="ghost"
              label={t('trash.restore')}
              disabled={!online || restore.isPending}
              onPress={() => restore.mutate(item.id)}
            />
          </View>
        ))}
      </ScreenScroll>
    </Screen>
  );
}
