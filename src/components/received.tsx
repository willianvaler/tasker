import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  useAcceptShare,
  useMyNote,
  useNoteForSender,
  usePendingShares,
} from '@/lib/queries/shares';
import type { Task } from '@/lib/queries/tasks';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Convites de página enviada ainda não aceitos (L4, D136): receber abre a página; recusar some.

export function PendingShares({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const pending = usePendingShares();
  const accept = useAcceptShare();
  const list = pending.data ?? [];
  if (list.length === 0) return null;
  return (
    <View className={compact ? 'gap-1 pl-2' : 'gap-2'}>
      {list.map((share) => {
        const label = t('received.pendingFrom', {
          page: share.page_name,
          name: share.owner_name ?? '—',
        });
        return (
          <View key={share.id} className="gap-1 border-b border-line py-1">
            <Text className="text-sm text-ink" numberOfLines={2}>
              {label}
            </Text>
            <View className="flex-row gap-1">
              <Button
                variant="ghost"
                label={t('received.accept')}
                disabled={!online || accept.pending.isPending}
                accessibilityLabel={`${t('received.accept')}: ${label}`}
                onPress={() =>
                  accept.pending.mutate(
                    { shareId: share.id, folderName: t('send.folderName') },
                    {
                      onSuccess: (result) =>
                        router.push({ pathname: '/page/[id]', params: { id: result.page_id } }),
                      onError: (err) => toast({ message: err.message }),
                    },
                  )
                }
              />
              <Button
                variant="ghost"
                label={t('received.decline')}
                disabled={!online}
                accessibilityLabel={`${t('received.decline')}: ${label}`}
                onPress={() =>
                  accept.decline.mutate(share.id, {
                    onError: (err) => toast({ message: err.message }),
                  })
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** No painel do item recebido: observação para quem enviou (salvar marca o item como feito). */
export function ReceivedNote({ task }: { task: Task }) {
  const { t } = useTranslation();
  const toast = useToast();
  const mine = useMyNote(task.id, task.page_id, task.recurrence);
  const save = useNoteForSender();
  const [text, setText] = useState<string | null>(null);
  const value = text ?? mine.data ?? '';
  function submit() {
    const note = value.trim();
    if (!note) return;
    save.mutate(
      { taskId: task.id, pageId: task.page_id, recurrence: task.recurrence, note },
      {
        onSuccess: () => toast({ message: t('received.noteSaved') }),
        onError: (err) => toast({ message: err.message }),
      },
    );
  }
  return (
    <View className="gap-2">
      <Input
        value={value}
        onChangeText={setText}
        multiline
        maxLength={500}
        placeholder={t('received.notePlaceholder')}
        accessibilityLabel={t('received.noteTitle')}
      />
      <Button
        variant="ghost"
        className="self-start"
        label={t('received.noteSave')}
        disabled={!value.trim() || save.isPending}
        onPress={submit}
      />
    </View>
  );
}
