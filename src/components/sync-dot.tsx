import { useQuery, useStatus } from '@powersync/react';
import { useMutationState } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { taskMutationKey } from '@/lib/queries/keys';
import { POWERSYNC_URL } from '@/lib/sync/connector';
import { useIsOnline } from '@/providers/online';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

/** Alterações esperando a conexão: a fila do sync (cada ação é uma transação) ou a antiga. */
export function usePendingChanges() {
  const paused = useMutationState({
    filters: { mutationKey: taskMutationKey, status: 'pending' },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;
  const queued = useQuery<{ n: number }>('select count(distinct tx_id) as n from ps_crud').data[0];
  return paused + (queued?.n ?? 0);
}

export function useSyncState(): SyncState {
  const online = useIsOnline();
  const status = useStatus();
  const pending = usePendingChanges();
  if (!online) return 'offline';
  if (!POWERSYNC_URL) return pending > 0 ? 'syncing' : 'synced';
  const flow = status.dataFlowStatus;
  if (flow.uploadError || flow.downloadError) return 'error';
  if (!status.connected) return status.connecting ? 'syncing' : 'offline';
  if (flow.uploading || flow.downloading || pending > 0 || !status.hasSynced) return 'syncing';
  return 'synced';
}

// Verde: em dia · laranja: sincronizando · vermelho: sem sincronizar
const COLOR: Record<SyncState, string> = {
  synced: 'bg-ok',
  syncing: 'bg-warn',
  offline: 'bg-danger',
  error: 'bg-danger',
};

/**
 * Ponto de estado do sync, no canto inferior esquerdo: no rodapé da barra lateral ou, no celular,
 * flutuando acima das abas (sem empurrar nada da tela). O nome aparece ao passar o mouse e o
 * toque leva à tela Sincronização.
 */
export function SyncDot({ floating }: { floating?: boolean }) {
  const { t } = useTranslation();
  const state = useSyncState();
  const pending = usePendingChanges();
  const insets = useSafeAreaInsets();
  const label =
    t(`sync.state_${state}`) +
    (pending > 0 ? ` · ${t('offline.waiting', { count: pending })}` : '');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push('/sync')}
      style={floating ? { position: 'absolute', left: 8, bottom: insets.bottom + 72 } : undefined}
      className={cn(
        'min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash',
        floating && 'min-w-8 justify-center',
      )}
    >
      {({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => (
        <>
          {(hovered || focused) && !floating && (
            <Text className="text-xs text-ink-muted">{label}</Text>
          )}
          <View className={cn('h-2 w-2 rounded-full', COLOR[state])} />
        </>
      )}
    </Pressable>
  );
}
