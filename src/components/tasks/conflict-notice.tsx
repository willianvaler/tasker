import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';

/** Versões das notas que perderam num conflito de sync (editadas em dois lugares ao mesmo tempo). */
export function ConflictNotice({
  taskId,
  writable,
  onRestore,
}: {
  taskId: string;
  writable: boolean;
  onRestore: (body: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ['tasks', 'conflicts', taskId];
  const copies = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conflict_copies')
        .select('id, body, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conflict_copies').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const copy = copies.data?.[0];
  if (!copy) return null;
  return (
    <View className="gap-2 rounded border border-line bg-wash p-3">
      <Text className="text-sm text-ink">{t('conflict.notice')}</Text>
      {open ? (
        <>
          <Text className="rounded bg-paper p-2 text-sm text-ink">{copy.body}</Text>
          {writable && (
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={t('conflict.restore')}
                onPress={() => {
                  onRestore(copy.body);
                  dismiss.mutate(copy.id);
                }}
              />
              <Button
                variant="ghost"
                label={t('conflict.dismiss')}
                onPress={() => dismiss.mutate(copy.id)}
              />
            </View>
          )}
        </>
      ) : (
        <Button variant="ghost" label={t('conflict.show')} onPress={() => setOpen(true)} />
      )}
    </View>
  );
}
