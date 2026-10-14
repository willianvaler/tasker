import { useStatus } from '@powersync/react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { usePendingChanges } from '@/components/offline-banner';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { POWERSYNC_URL } from '@/lib/sync/connector';
import { useIsOnline } from '@/providers/online';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

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

const COLOR: Record<SyncState, string> = {
  synced: 'bg-ok',
  syncing: 'bg-accent',
  offline: 'bg-warn',
  error: 'bg-danger',
};

/** Ponto de estado do sync (barra lateral); o nome aparece ao passar o mouse e leva à tela. */
export function SyncDot() {
  const { t } = useTranslation();
  const state = useSyncState();
  const label = t(`sync.state_${state}`);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push('/sync')}
      className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash"
    >
      {({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => (
        <>
          {(hovered || focused) && <Text className="text-xs text-ink-muted">{label}</Text>}
          <View className={cn('h-2 w-2 rounded-full', COLOR[state])} />
        </>
      )}
    </Pressable>
  );
}
