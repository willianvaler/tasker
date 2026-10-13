import { useMutationState } from '@tanstack/react-query';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { taskMutationKey } from '@/lib/queries/keys';
import { useIsOnline } from '@/providers/online';

/** Alterações de tarefa esperando a conexão (fila offline, D52). */
export function usePendingChanges() {
  return useMutationState({
    filters: { mutationKey: taskMutationKey, status: 'pending' },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;
}

export function OfflineBanner() {
  const online = useIsOnline();
  const pending = usePendingChanges();
  if (online && pending === 0) return null;
  const waiting =
    pending === 0
      ? ''
      : pending === 1
        ? ' 1 alteração esperando.'
        : ` ${pending} alterações esperando.`;
  return (
    <View accessibilityRole="alert" className="bg-wash px-4 py-2">
      <Text className="text-center text-sm text-ink-muted">
        {online
          ? `Enviando o que ficou guardado…${waiting}`
          : `Sem conexão. Dá para criar, marcar e reordenar tarefas: vão quando a internet voltar.${waiting}`}
      </Text>
    </View>
  );
}
