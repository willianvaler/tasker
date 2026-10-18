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

// server: há internet, mas o servidor não responde (D179); diferente de estar sem internet
export type SyncState = 'synced' | 'syncing' | 'offline' | 'server' | 'error';

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
  // Sem conexão com o sync e com erro na conexão: o servidor está fora (as tentativas seguem)
  if (!status.connected && flow.downloadError) return 'server';
  if (flow.uploadError || flow.downloadError) return 'error';
  if (!status.connected) return status.connecting ? 'syncing' : 'server';
  if (flow.uploading || flow.downloading || pending > 0 || !status.hasSynced) return 'syncing';
  return 'synced';
}

// Verde: em dia · laranja: sincronizando · vermelho: sem sincronizar
const COLOR: Record<SyncState, string> = {
  synced: 'bg-ok',
  syncing: 'bg-warn',
  offline: 'bg-danger',
  server: 'bg-danger',
  error: 'bg-danger',
};

/**
 * Ponto de estado do sync, no canto inferior esquerdo: no rodapé da barra lateral ou, no celular,
 * flutuando acima das abas (sem empurrar nada da tela). O nome aparece ao passar o mouse e o
 * toque leva à tela Sincronização.
 */
export function SyncDot({ floating }: { floating?: boolean }) {
  const { t } = useTranslation();
  const syncState = useSyncState();
  const pending = usePendingChanges();
  const insets = useSafeAreaInsets();
  const label =
    t(`sync.state_${syncState}`) +
    (pending > 0 ? ` · ${t('offline.waiting', { count: pending })}` : '');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push('/sync')}
      // Y2 (#3): no celular, em dia, o ponto some (flutuava por cima do conteúdo). Fica na página,
      // invisível e sem pegar toques, para quem lê a tela saber o estado
      pointerEvents={floating && syncState === 'synced' ? 'none' : 'auto'}
      style={
        floating
          ? {
              position: 'absolute',
              left: 8,
              bottom: insets.bottom + 72,
              opacity: syncState === 'synced' ? 0 : 1,
            }
          : undefined
      }
      className={cn(
        'min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash',
        floating && 'min-w-8 justify-center',
      )}
    >
      {(state) => {
        // hovered e focused existem na web (react-native-web); o tipo do React Native não tem
        const { hovered, focused } = state as { hovered?: boolean; focused?: boolean };
        return (
          <>
            {(hovered || focused) && !floating && (
              <Text className="text-xs text-ink-muted">{label}</Text>
            )}
            <View className={cn('h-2 w-2 rounded-full', COLOR[syncState])} />
          </>
        );
      }}
    </Pressable>
  );
}
