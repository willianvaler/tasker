import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode } from 'react';

import { registerOfflineRepMutations } from '@/lib/queries/repeat';
import { registerOfflineTaskMutations } from '@/lib/queries/tasks';
import { localStore } from '@/lib/storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Mantém o cache por 7 dias para o app abrir offline com os dados da última sessão
      gcTime: 7 * 24 * 60 * 60 * 1000,
      // Roda a consulta mesmo sem rede: as que leem do banco do aparelho funcionam offline, e as do
      // Supabase falham e ficam com o cache (no padrão "online", ficariam pausadas com dado velho)
      networkMode: 'offlineFirst',
    },
  },
});

// Fila offline: as mutações de tarefa restauradas do disco precisam saber como se executar
registerOfflineTaskMutations(queryClient);
registerOfflineRepMutations(queryClient);

const persister = createSyncStoragePersister({ storage: localStore, key: 'questlist-cache' });

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      // buster: mude quando o formato de algum dado em cache mudar (o cache do disco não passa pelo
      // zod de novo). v3 = Fase 7 (game_state com personagem, tarefas com contagens de hábito)
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: 'v15' }}
      // O cache do disco serve para abrir rápido (e offline), mas pode estar velho: o ciclo virou,
      // ou a última gravação não chegou a ser salva. Depois de restaurar, reenvia a fila offline
      // (se houver conexão) e busca tudo de novo.
      onSuccess={() =>
        queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())
      }
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Ao sair da conta: apaga o cache (memória e disco) para o próximo usuário não ver nada. */
export function clearQueryCache() {
  queryClient.clear();
  persister.removeClient();
}
