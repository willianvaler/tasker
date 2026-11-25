import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { usePageInstances } from '@/lib/queries/processos';
import { useIsOnline } from '@/providers/online';

/** "Processos desta página" (PR7, D357): os que começaram por esta anotação, com a situação. */
export function PageProcesses({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const q = usePageInstances(online ? noteId : undefined);
  const lista = q.data ?? [];
  if (!lista.length) return null;
  return (
    <View className="mt-6 gap-1" testID="page-processes">
      <SectionLabel title={t('processos.ofPage')} />
      {lista.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="link"
          onPress={() =>
            router.push({ pathname: '/processos/instancia/[id]', params: { id: i.id } })
          }
          className="rounded-lg hover:bg-surface-muted flex-row items-center justify-between px-2 py-2"
        >
          <Text>{(i.process_definitions as { name: string } | null)?.name ?? '—'}</Text>
          <Text className="text-sm text-ink-muted">
            {t(`processos.status.${i.status}` as 'processos.status.concluida')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
