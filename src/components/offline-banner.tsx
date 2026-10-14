import { useQuery } from '@powersync/react';
import { useMutationState } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { taskMutationKey } from '@/lib/queries/keys';
import { useIsOnline } from '@/providers/online';

/** Alterações esperando a conexão: a fila do sync (cada ação é uma transação) ou a antiga. */
export function usePendingChanges() {
  const paused = useMutationState({
    filters: { mutationKey: taskMutationKey, status: 'pending' },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;
  const queued = useQuery<{ n: number }>('select count(distinct tx_id) as n from ps_crud').data[0];
  return paused + (queued?.n ?? 0);
}

/** Faixa fina no topo quando não há conexão ou há alterações na fila (sem banner gritante). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const pending = usePendingChanges();
  if (online && pending === 0) return null;
  const waiting = pending === 0 ? '' : ` ${t('offline.waiting', { count: pending })}`;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center justify-center gap-2 border-b border-line bg-surface px-4 py-2"
    >
      <View className={online ? 'h-2 w-2 rounded-full bg-ok' : 'h-2 w-2 rounded-full bg-warn'} />
      <Text className="text-center text-xs text-ink-muted">
        {t(online ? 'offline.sending' : 'offline.offline')}
        {waiting}
      </Text>
    </View>
  );
}
